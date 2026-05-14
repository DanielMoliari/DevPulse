import { Controller, Get, Logger, Query, Res, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import type { FastifyReply } from 'fastify'
import { randomBytes } from 'node:crypto'
import { GitHubProfileVO } from '../../domain/value-objects/github-profile.vo'
import { IdentityService } from '../../application/services/identity.service'
import { WelcomeEmailService } from '../../../../modules/notifications/application/services/welcome-email.service'
import { RedisService } from '../../../../infrastructure/cache/redis.service'

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
    private readonly welcomeEmailService: WelcomeEmailService,
    private readonly redis: RedisService,
  ) {}

  @Get('github')
  @ApiOperation({ summary: 'Initiate GitHub OAuth flow' })
  async githubAuth(
    @Query('intent') intent: string | undefined,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const clientId = this.config.getOrThrow<string>('GITHUB_CLIENT_ID')
    const callbackUrl = this.config.getOrThrow<string>('GITHUB_CALLBACK_URL')
    const scope = ['user:email', 'repo', 'read:org'].join(' ')
    const csrf = randomBytes(32).toString('hex')
    const statePayload = JSON.stringify({ csrf, intent: intent ?? null })
    await this.redis.client.set(`oauth:state:${csrf}`, statePayload, 'EX', 600)
    const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(csrf)}`
    await reply.status(302).redirect(url)
  }

  @Get('github/callback')
  @ApiOperation({ summary: 'GitHub OAuth callback' })
  async githubCallback(
    @Query('code') code: string,
    @Query('state') state: string | undefined,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    if (!code) throw new UnauthorizedException('Missing OAuth code')
    if (!state) throw new UnauthorizedException('Missing OAuth state')

    const stored = await this.redis.client.get(`oauth:state:${state}`)
    if (!stored) throw new UnauthorizedException('Invalid or expired OAuth state')
    await this.redis.client.del(`oauth:state:${state}`)

    const statePayload = JSON.parse(stored) as { csrf: string; intent: string | null }

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

    const { accessToken: jwt, user } = await this.identityService.loginWithGitHub(vo)
    void this.welcomeEmailService.maybeSendWelcome(user)
    const frontendUrl = this.frontendBaseUrl()
    const isProduction = this.config.get<string>('NODE_ENV') === 'production'
    // @fastify/cookie augments FastifyReply at runtime; cast to bypass stale type declarations
    const r = reply as unknown as { setCookie: (name: string, value: string, opts: Record<string, unknown>) => void }
    r.setCookie('auth_token', jwt, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 15 * 24 * 60 * 60,
      path: '/',
    })
    const intentParam = statePayload.intent ? `?intent=${encodeURIComponent(statePayload.intent)}` : ''
    await reply.status(302).redirect(`${frontendUrl}/auth/callback${intentParam}`)
  }

  @Get('logout')
  @ApiOperation({ summary: 'Clear auth cookie and log out' })
  async logout(@Res() reply: FastifyReply): Promise<void> {
    const r = reply as unknown as { clearCookie: (name: string, opts: Record<string, unknown>) => void }
    r.clearCookie('auth_token', { path: '/' })
    await reply.status(200).send({ message: 'Logged out' })
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
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'reflog' },
    })
    if (!userRes.ok) throw new UnauthorizedException('Failed to fetch GitHub profile')
    const user = (await userRes.json()) as GitHubUserResponse

    if (!user.email) {
      const emailsRes = await fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'reflog' },
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
