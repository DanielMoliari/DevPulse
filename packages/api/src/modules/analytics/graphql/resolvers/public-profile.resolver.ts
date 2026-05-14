import { UseGuards } from '@nestjs/common'
import { Throttle, ThrottlerGuard } from '@nestjs/throttler'
import { Args, Query, Resolver } from '@nestjs/graphql'
import { PublicProfileType } from '../../../identity/graphql/types/public-profile.type'
import { PublicProfileService } from '../../application/services/public-profile.service'
import { GitHubLookupService } from '../../application/services/github-lookup.service'
import { SearchProfileResultType, SearchRepoResultType } from '../types/search-profile.type'

@Resolver(() => PublicProfileType)
export class PublicProfileResolver {
  constructor(
    private readonly publicProfileService: PublicProfileService,
    private readonly gitHubLookupService: GitHubLookupService,
  ) {}

  // ── Global search — no auth required ────────────────────────────────────
  @UseGuards(ThrottlerGuard)
  @Throttle({ short: { limit: 10, ttl: 10000 } })
  @Query(() => SearchProfileResultType, { nullable: true, name: 'searchProfile' })
  async searchProfile(@Args('query') query: string): Promise<SearchProfileResultType | null> {
    const username = query.trim()
    if (!username) return null

    // 1. Check reflog first — richer data, streak included
    const reflogProfile = await this.publicProfileService.getPublicProfile(username)
    if (reflogProfile) {
      return {
        source: 'reflog',
        username: reflogProfile.username,
        displayName: reflogProfile.displayName,
        ...(reflogProfile.avatarUrl ? { avatarUrl: reflogProfile.avatarUrl } : {}),
        totalCommits: reflogProfile.totalCommits,
        ...(reflogProfile.currentStreak !== null ? { currentStreak: reflogProfile.currentStreak } : {}),
        topLanguages: reflogProfile.topLanguages,
        ...(reflogProfile.trackedRepos ? {
          topRepos: reflogProfile.trackedRepos.map((r) => ({
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
  @UseGuards(ThrottlerGuard)
  @Throttle({ short: { limit: 10, ttl: 10000 } })
  @Query(() => SearchRepoResultType, { nullable: true, name: 'searchRepo' })
  async searchRepo(
    @Args('owner') owner: string,
    @Args('repo') repo: string,
  ): Promise<SearchRepoResultType | null> {
    if (!owner.trim() || !repo.trim()) return null
    return this.gitHubLookupService.lookupRepo(owner.trim(), repo.trim())
  }

  // ── Public read query ────────────────────────────────────────────────────
  // Intentionally NO @UseGuards(GqlAuthGuard): the /u/{username} page must work for anonymous visitors.
  @UseGuards(ThrottlerGuard)
  @Throttle({ short: { limit: 20, ttl: 10000 } })
  @Query(() => PublicProfileType, {
    nullable: true,
    description: 'Anonymous-readable curated profile for any registered user.',
  })
  async publicProfile(@Args('username') username: string): Promise<PublicProfileType | null> {
    const data = await this.publicProfileService.getPublicProfile(username)
    if (!data) return null
    // Spread to GraphQL shape — null fields collapse to undefined for exactOptionalPropertyTypes
    const out: PublicProfileType = {
      username: data.username,
      displayName: data.displayName,
      joinedAt: data.joinedAt instanceof Date ? data.joinedAt : new Date(data.joinedAt as unknown as string),
      activeDays: data.activeDays,
      totalCommits: data.totalCommits,
      totalAdditions: data.totalAdditions,
      totalPrs: data.totalPrs,
      avgCommitsPerActiveDay: data.avgCommitsPerActiveDay,
      topLanguages: data.topLanguages,
      recentActivity: data.recentActivity.map((a) => ({
        ...a,
        date: a.date instanceof Date ? a.date : new Date(a.date as unknown as string),
      })),
      ...(data.avatarUrl ? { avatarUrl: data.avatarUrl } : {}),
      ...(data.currentStreak !== null ? { currentStreak: data.currentStreak } : {}),
      ...(data.longestStreak !== null ? { longestStreak: data.longestStreak } : {}),
      ...(data.trackedRepos !== null ? { trackedRepos: data.trackedRepos.map((r) => ({ fullName: r.fullName, ...(r.language ? { language: r.language } : {}) })) } : {}),
    }
    return out
  }

}
