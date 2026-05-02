import { Controller, Get, Logger, Query, Res, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import type { FastifyReply } from 'fastify'
import { GitHubProfileVO } from '../../domain/value-objects/github-profile.vo'
import { IdentityService } from '../../application/services/identity.service'

interface GitHubTokenResponse {
  access_token?: string
  error?: string
  error_description?: string
}

interface GitHubUserResponse {
  id: number
  login: string
  name: string | null
  email: string | null
  avatar_url: string | null
}

interface GitHubEmailResponse {
  email: string
  primary: boolean
  verified: boolean
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name)

  constructor(
    private readonly identityService: IdentityService,
    private readonly config: ConfigService,
  ) {}

  @Get('github')
  @ApiOperation({ summary: 'Initiate GitHub OAuth flow' })
  async githubAuth(@Res() reply: FastifyReply): Promise<void> {
    const clientId = this.config.getOrThrow<string>('GITHUB_CLIENT_ID')
    const callbackUrl = this.config.getOrThrow<string>('GITHUB_CALLBACK_URL')
    const scope = ['user:email', 'repo', 'read:org'].join(' ')
    const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=${encodeURIComponent(scope)}`
    await reply.status(302).redirect(url)
  }

  @Get('github/callback')
  @ApiOperation({ summary: 'GitHub OAuth callback' })
  async githubCallback(
    @Query('code') code: string,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    if (!code) throw new UnauthorizedException('Missing OAuth code')

    const accessToken = await this.exchangeCodeForToken(code)
    const profile = await this.fetchGitHubProfile(accessToken)
    const vo = new GitHubProfileVO(
      String(profile.id),
      profile.login,
      profile.name,
      profile.email,
      profile.avatar_url,
      accessToken,
    )

    const { accessToken: jwt } = await this.identityService.loginWithGitHub(vo)
    const frontendUrl = this.frontendBaseUrl()
    await reply.status(302).redirect(`${frontendUrl}/auth/callback?token=${jwt}`)
  }

  @Get('logout')
  @ApiOperation({ summary: 'Logout (client should discard JWT)' })
  logout(): { message: string } {
    return { message: 'Logged out. Discard your token on the client.' }
  }

  private async exchangeCodeForToken(code: string): Promise<string> {
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: this.config.getOrThrow<string>('GITHUB_CLIENT_ID'),
        client_secret: this.config.getOrThrow<string>('GITHUB_CLIENT_SECRET'),
        code,
      }),
    })
    const data = (await res.json()) as GitHubTokenResponse
    if (!data.access_token) {
      this.logger.error(`Token exchange failed: ${data.error_description ?? data.error}`)
      throw new UnauthorizedException('GitHub token exchange failed')
    }
    return data.access_token
  }

  private async fetchGitHubProfile(token: string): Promise<GitHubUserResponse> {
    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'DevPulse' },
    })
    if (!userRes.ok) throw new UnauthorizedException('Failed to fetch GitHub profile')
    const user = (await userRes.json()) as GitHubUserResponse

    if (!user.email) {
      const emailsRes = await fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'DevPulse' },
      })
      if (emailsRes.ok) {
        const emails = (await emailsRes.json()) as GitHubEmailResponse[]
        user.email = emails.find((e) => e.primary && e.verified)?.email ?? null
      }
    }

    return user
  }

  private frontendBaseUrl(): string {
    const origins = this.config.get<string>('ALLOWED_ORIGINS')
    return origins?.split(',')[0] ?? 'http://localhost:38929'
  }
}
