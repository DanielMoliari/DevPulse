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
import { GitHubLookupService } from '../../application/services/github-lookup.service'
import { SearchProfileResultType, SearchRepoResultType } from '../types/search-profile.type'

@Resolver(() => PublicProfileType)
export class PublicProfileResolver {
  constructor(
    private readonly publicProfileService: PublicProfileService,
    private readonly identityService: IdentityService,
    private readonly gitHubLookupService: GitHubLookupService,
  ) {}

  // ── Global search — no auth required ────────────────────────────────────
  @Query(() => SearchProfileResultType, { nullable: true, name: 'searchProfile' })
  async searchProfile(@Args('query') query: string): Promise<SearchProfileResultType | null> {
    const username = query.trim()
    if (!username) return null

    // 1. Check DevPulse first — richer data, streak included
    const devpulse = await this.publicProfileService.getPublicProfile(username)
    if (devpulse) {
      return {
        source: 'devpulse',
        username: devpulse.username,
        displayName: devpulse.displayName,
        ...(devpulse.avatarUrl ? { avatarUrl: devpulse.avatarUrl } : {}),
        totalCommits: devpulse.totalCommits,
        ...(devpulse.currentStreak !== null ? { currentStreak: devpulse.currentStreak } : {}),
        topLanguages: devpulse.topLanguages,
        ...(devpulse.trackedRepos ? {
          topRepos: devpulse.trackedRepos.map((r) => ({
            fullName: r.fullName,
            ...(r.language ? { language: r.language } : {}),
            stargazersCount: 0,
          })),
        } : {}),
      }
    }

    // 2. Fall back to anonymous GitHub API
    const gh = await this.gitHubLookupService.lookup(username)
    if (!gh) return null
    return {
      source: 'github',
      username: gh.user.login,
      displayName: gh.user.name ?? gh.user.login,
      ...(gh.user.avatarUrl ? { avatarUrl: gh.user.avatarUrl } : {}),
      ...(gh.user.bio ? { bio: gh.user.bio } : {}),
      ...(gh.user.location ? { location: gh.user.location } : {}),
      followers: gh.user.followers,
      publicRepos: gh.user.publicRepos,
      topLanguages: gh.topLanguages,
      topRepos: gh.topRepos.map((r) => ({
        fullName: r.fullName,
        ...(r.language ? { language: r.language } : {}),
        stargazersCount: r.stargazersCount,
      })),
    }
  }

  // ── Repo search — no auth required ──────────────────────────────────────
  @Query(() => SearchRepoResultType, { nullable: true, name: 'searchRepo' })
  async searchRepo(
    @Args('owner') owner: string,
    @Args('repo') repo: string,
  ): Promise<SearchRepoResultType | null> {
    if (!owner.trim() || !repo.trim()) return null
    return this.gitHubLookupService.lookupRepo(owner.trim(), repo.trim())
  }

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
