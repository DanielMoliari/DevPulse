import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql'
import { GqlAuthGuard } from '../../../../common/guards/gql-auth.guard'
import { CurrentUser, type JwtPayload } from '../../../../common/decorators/current-user.decorator'
import { IdentityService } from '../../../identity/application/services/identity.service'
import {
  EnablePublicProfileInput,
  UpdatePublicProfilePrefsInput,
} from '../../../identity/graphql/types/public-profile.input'
import { PublicProfileType } from '../../../identity/graphql/types/public-profile.type'
import { UserType } from '../../../identity/graphql/types/user.type'
import { PublicProfileService } from '../../application/services/public-profile.service'

@Resolver(() => PublicProfileType)
export class PublicProfileResolver {
  constructor(
    private readonly publicProfileService: PublicProfileService,
    private readonly identityService: IdentityService,
  ) {}

  // ── Public read query ────────────────────────────────────────────────────
  // Intentionally NO @UseGuards: the /u/{username} page must work for anonymous visitors.
  // The service returns null when the user opted out, so the resolver simply forwards.
  @Query(() => PublicProfileType, {
    nullable: true,
    description: 'Anonymous-readable curated profile. Returns null when the user has not opted in.',
  })
  async publicProfile(@Args('username') username: string): Promise<PublicProfileType | null> {
    const data = await this.publicProfileService.getPublicProfile(username)
    if (!data) return null
    // Spread to GraphQL shape — null fields collapse to undefined for exactOptionalPropertyTypes
    const out: PublicProfileType = {
      username: data.username,
      displayName: data.displayName,
      joinedAt: data.joinedAt,
      activeDays: data.activeDays,
      totalCommits: data.totalCommits,
      topLanguages: data.topLanguages,
      recentActivity: data.recentActivity,
      ...(data.avatarUrl ? { avatarUrl: data.avatarUrl } : {}),
      ...(data.currentStreak !== null ? { currentStreak: data.currentStreak } : {}),
      ...(data.longestStreak !== null ? { longestStreak: data.longestStreak } : {}),
      ...(data.trackedRepos !== null ? { trackedRepos: data.trackedRepos.map((r) => ({ fullName: r.fullName, ...(r.language ? { language: r.language } : {}) })) } : {}),
    }
    return out
  }

  // ── Authenticated mutations ──────────────────────────────────────────────
  @Mutation(() => UserType, { description: 'Reserve a username and turn the public profile on.' })
  @UseGuards(GqlAuthGuard)
  async enablePublicProfile(
    @CurrentUser() current: JwtPayload,
    @Args('input') input: EnablePublicProfileInput,
  ): Promise<UserType> {
    const user = await this.identityService.enablePublicProfile(current.sub, input.username)
    await this.publicProfileService.invalidate(user.username)
    return user as unknown as UserType
  }

  @Mutation(() => UserType, { description: 'Toggle which sections appear on the public profile.' })
  @UseGuards(GqlAuthGuard)
  async updatePublicProfilePrefs(
    @CurrentUser() current: JwtPayload,
    @Args('input') input: UpdatePublicProfilePrefsInput,
  ): Promise<UserType> {
    const user = await this.identityService.updatePublicProfilePrefs(current.sub, input)
    await this.publicProfileService.invalidate(user.username)
    return user as unknown as UserType
  }

  @Mutation(() => UserType, { description: 'Hide the public profile while keeping the username reserved.' })
  @UseGuards(GqlAuthGuard)
  async disablePublicProfile(@CurrentUser() current: JwtPayload): Promise<UserType> {
    const user = await this.identityService.disablePublicProfile(current.sub)
    await this.publicProfileService.invalidate(user.username)
    return user as unknown as UserType
  }
}
