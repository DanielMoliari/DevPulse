import { BadRequestException, ConflictException, Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import type { User } from '@prisma/client'
import type { JwtPayload } from '../../../../common/decorators/current-user.decorator'
import { EncryptionService } from '../../../../infrastructure/crypto/encryption.service'
import type { GitHubProfileVO } from '../../domain/value-objects/github-profile.vo'
import { USER_REPOSITORY, type IUserRepository } from '../../ports/user.repository.port'

// Lowercase, alphanumeric + dash, 3-30 chars (matches GitHub-style handles)
const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/i
const RESERVED_USERNAMES = new Set(['admin', 'root', 'api', 'auth', 'login', 'signup', 'settings', 'dashboard', 'u', 'me', 'reflog', 'support', 'help'])

@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name)

  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    private readonly jwtService: JwtService,
    private readonly encryptionService: EncryptionService,
    private readonly configService: ConfigService,
  ) {}

  async loginWithGitHub(profile: GitHubProfileVO): Promise<{ accessToken: string; user: User }> {
    const encryptedToken = await this.encryptionService.encrypt(profile.accessToken)

    const user = await this.userRepository.upsertFromGitHub({
      githubId: profile.githubId,
      githubUsername: profile.username,
      name: profile.displayName,
      email: profile.email,
      avatarUrl: profile.avatarUrl,
      encryptedToken,
    })

    this.logger.log(`User authenticated: ${user.id} (github: ${profile.username})`)

    const accessToken = this.issueJwt(user)
    return { accessToken, user }
  }

  issueJwt(user: User): string {
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: user.id,
      githubId: user.githubId,
      plan: user.plan,
    }
    return this.jwtService.sign(payload)
  }

  async findById(userId: string): Promise<User | null> {
    return this.userRepository.findById(userId)
  }

  async getDecryptedToken(userId: string): Promise<string> {
    const user = await this.userRepository.findById(userId)
    if (!user) throw new UnauthorizedException('User not found')
    return this.encryptionService.decrypt(user.githubToken)
  }

  async updateProfile(userId: string, data: { name?: string; email?: string; notificationsEnabled?: boolean; streakAlertsEnabled?: boolean }): Promise<User> {
    return this.userRepository.updateProfile(userId, data)
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.userRepository.findByUsername(username)
  }

  // Activates the public profile and reserves a unique handle. Validation lives here (not in
  // the resolver) so any future caller — REST, CLI, internal job — gets the same guarantees.
  async enablePublicProfile(userId: string, username: string): Promise<User> {
    const normalized = username.trim().toLowerCase()
    if (!USERNAME_PATTERN.test(normalized) || normalized.length < 3 || normalized.length > 30) {
      throw new BadRequestException('Username must be 3-30 chars, alphanumeric or dash, no leading/trailing dash.')
    }
    if (RESERVED_USERNAMES.has(normalized)) {
      throw new BadRequestException('That username is reserved.')
    }
    const existing = await this.userRepository.findByUsername(normalized)
    if (existing && existing.id !== userId) {
      throw new ConflictException('Username already taken.')
    }
    return this.userRepository.updatePublicProfile(userId, {
      username: normalized,
      publicProfile: true,
      publicShowRepos: true,
      publicShowStreak: true,
    })
  }

  async updatePublicProfilePrefs(
    userId: string,
    prefs: { showRepos?: boolean; showStreak?: boolean },
  ): Promise<User> {
    const data: { publicShowRepos?: boolean; publicShowStreak?: boolean } = {}
    if (prefs.showRepos !== undefined) data.publicShowRepos = prefs.showRepos
    if (prefs.showStreak !== undefined) data.publicShowStreak = prefs.showStreak
    return this.userRepository.updatePublicProfile(userId, data)
  }

  async disablePublicProfile(userId: string): Promise<User> {
    // Username stays reserved so re-enabling preserves shareable links and prevents handle squatting.
    return this.userRepository.updatePublicProfile(userId, { publicProfile: false })
  }

  async deleteAccount(userId: string): Promise<boolean> {
    await this.userRepository.deleteUser(userId)
    return true
  }

  async getPlatformStats(): Promise<{ userCount: number; commitCount: number }> {
    return this.userRepository.getPlatformStats()
  }
}
