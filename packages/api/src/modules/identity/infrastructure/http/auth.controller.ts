import { Controller, Get, Logger, Req, Res, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import type { FastifyReply, FastifyRequest } from 'fastify'
import type { GitHubProfileVO } from '../../domain/value-objects/github-profile.vo'
import { IdentityService } from '../../application/services/identity.service'

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name)

  constructor(private readonly identityService: IdentityService) {}

  @Get('github')
  @UseGuards(AuthGuard('github'))
  @ApiOperation({ summary: 'Initiate GitHub OAuth flow' })
  githubAuth(): void {
    // Passport handles the redirect
  }

  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  @ApiOperation({ summary: 'GitHub OAuth callback' })
  async githubCallback(
    @Req() req: FastifyRequest & { user: GitHubProfileVO },
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const { accessToken } = await this.identityService.loginWithGitHub(req.user)
    const frontendUrl = process.env['NEXT_PUBLIC_API_URL']
      ?.replace(':17642', ':38929')
      ?? 'http://localhost:38929'
    await reply.redirect(`${frontendUrl}/auth/callback?token=${accessToken}`)
  }

  @Get('logout')
  @ApiOperation({ summary: 'Logout (client should discard JWT)' })
  logout(): { message: string } {
    return { message: 'Logged out. Discard your token on the client.' }
  }
}
