import type { Metadata } from 'next'
import Link from 'next/link'
import { Flame, GitBranch, Calendar, Code2, Trophy, Users, Star, MapPin, TrendingUp } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { Heatmap } from '@/components/heatmap'
import { EmbedCardButton } from '@/components/embed-card-button'
import { ShareButton } from '@/components/share-button'
import { ssrGraphQL } from '@/lib/graphql-ssr'
import { formatNumber, languageColor } from '@/lib/utils'
import type { PublicProfile } from '@/graphql/types'

const PROFILE_QUERY = `
  query PublicProfile($username: String!) {
    publicProfile(username: $username) {
      username
      displayName
      avatarUrl
      joinedAt
      activeDays
      totalCommits
      totalAdditions
      totalPrs
      avgCommitsPerActiveDay
      currentStreak
      longestStreak
      topLanguages { name bytes percent }
      recentActivity { date count level }
      trackedRepos { fullName language }
    }
  }
`

const PLATFORM_STATS_QUERY = `
  query PlatformStats {
    platformStats { userCount commitCount }
  }
`

const SEARCH_QUERY = `
  query SearchProfile($query: String!) {
    searchProfile(query: $query) {
      source username displayName avatarUrl bio location followers publicRepos
      topLanguages { name percent }
      topRepos { fullName language stargazersCount }
    }
  }
`

interface GithubProfile {
  source: string
  username: string
  displayName: string
  avatarUrl?: string
  bio?: string
  location?: string
  followers?: number
  publicRepos?: number
  topLanguages?: { name: string; percent: number }[]
  topRepos?: { fullName: string; language?: string; stargazersCount: number }[]
}

interface PageProps {
  params: Promise<{ username: string }>
}

async function fetchDevPulseProfile(username: string): Promise<PublicProfile | null> {
  const data = await ssrGraphQL<{ publicProfile: PublicProfile | null }>(
    PROFILE_QUERY,
    { username },
    { revalidate: 60 },
  )
  return data?.publicProfile ?? null
}

async function fetchGitHubProfile(username: string): Promise<GithubProfile | null> {
  const data = await ssrGraphQL<{ searchProfile: GithubProfile | null }>(
    SEARCH_QUERY,
    { query: username },
    { revalidate: 300 },
  )
  const result = data?.searchProfile ?? null
  if (!result || result.source !== 'github') return null
  return result
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params
  const profile = await fetchDevPulseProfile(username)

  if (profile) {
    const streakBlurb = profile.currentStreak !== null && profile.currentStreak > 0
      ? `${profile.currentStreak}-day streak · `
      : ''
    const description = `${streakBlurb}${formatNumber(profile.totalCommits)} commits · ${profile.activeDays} active days in the last year`
    const title = `${profile.displayName} on reflog`
    // og:image is handled by opengraph-image.tsx (Next.js native, 1200×627)
    return {
      title,
      description,
      openGraph: {
        title, description, type: 'profile',
        url: `/u/${username}`,
      },
      twitter: { card: 'summary_large_image', title, description },
    }
  }

  const gh = await fetchGitHubProfile(username)
  if (gh) {
    const title = `${gh.displayName} · GitHub`
    const description = [
      gh.bio,
      gh.followers != null ? `${gh.followers.toLocaleString()} followers` : null,
      gh.publicRepos != null ? `${gh.publicRepos} repos` : null,
    ].filter(Boolean).join(' · ')
    return {
      title,
      description: description || `${gh.username} on GitHub`,
      openGraph: {
        title, description: description || `${gh.username} on GitHub`,
        ...(gh.avatarUrl ? { images: [{ url: gh.avatarUrl }] } : {}),
      },
    }
  }

  return {
    title: 'Profile not found · reflog',
    description: `@${username} was not found on reflog or GitHub.`,
  }
}

function joinedLabel(iso: string): string {
  const d = new Date(iso)
  return `On reflog since ${d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
}

function activeDaysLabel(activeDays: number): string | null {
  if (activeDays >= 300) return 'Top 1% most active'
  if (activeDays >= 200) return 'Top 5% most active'
  if (activeDays >= 100) return 'Top 15% most active'
  if (activeDays >= 50) return 'Top 30% most active'
  return null
}

function linesWrittenLabel(totalAdditions: number): string | null {
  if (totalAdditions >= 500_000) return 'Top 5% by lines written'
  if (totalAdditions >= 200_000) return 'Top 15% by lines written'
  if (totalAdditions >= 50_000) return 'Top 30% by lines written'
  return null
}

function prsLabel(totalPrs: number): string | null {
  if (totalPrs >= 500) return 'Top 5% by PRs opened'
  if (totalPrs >= 200) return 'Top 15% by PRs opened'
  if (totalPrs >= 50) return 'Top 30% by PRs opened'
  return null
}

function commitIntensityLabel(avgCommitsPerActiveDay: number): string | null {
  if (avgCommitsPerActiveDay >= 10) return 'Top 10% commit intensity'
  if (avgCommitsPerActiveDay >= 5) return 'Top 25% commit intensity'
  return null
}

function NotFoundState({ username }: { username: string }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-surface-2">
        <GitBranch className="h-7 w-7 text-slate-500" />
      </div>
      <h1 className="text-2xl font-bold text-slate-100">No profile found</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-500">
        <span className="font-mono text-slate-300">@{username}</span> isn&apos;t on reflog yet
        and wasn&apos;t found on GitHub either.
      </p>
      <p className="mt-2 text-xs text-slate-600">Double-check the username — or be the first.</p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent/20 hover:bg-accent/90 transition-colors"
      >
        Start tracking for free →
      </Link>
    </div>
  )
}

function GitHubProfilePage({ gh }: { gh: GithubProfile }) {
  const initials = gh.displayName.split(/\s+/).map((n) => n[0] ?? '').join('').toUpperCase().slice(0, 2)

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-start sm:text-left">
        <Avatar className="h-24 w-24 ring-2 ring-border-2">
          <AvatarImage src={gh.avatarUrl ?? undefined} alt={gh.displayName} />
          <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap">
            <h1 className="text-3xl font-bold tracking-tight text-slate-100 sm:text-4xl">{gh.displayName}</h1>
            <span className="rounded-full border border-border-2 bg-surface-2 px-2.5 py-0.5 text-xs text-slate-500">
              GitHub
            </span>
          </div>
          <p className="mt-1 font-mono text-sm text-slate-500">@{gh.username}</p>
          {gh.bio && <p className="mt-2 text-sm text-slate-400 max-w-prose">{gh.bio}</p>}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-600 sm:justify-start">
            {gh.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />{gh.location}
              </span>
            )}
            {gh.followers != null && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />{gh.followers.toLocaleString()} followers
              </span>
            )}
            {gh.publicRepos != null && (
              <span className="flex items-center gap-1">
                <GitBranch className="h-3 w-3" />{gh.publicRepos} repos
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Top languages */}
      {gh.topLanguages && gh.topLanguages.length > 0 && (
        <section>
          <Card>
            <p className="mb-4 flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-slate-500">
              <Code2 className="h-3 w-3" /> Top languages
            </p>
            <div className="space-y-3">
              {gh.topLanguages.map((lang) => (
                <div key={lang.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: languageColor(lang.name) }} />
                      <span className="text-slate-200 font-medium">{lang.name}</span>
                    </div>
                    <span className="tabular text-slate-500">{lang.percent.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${lang.percent}%`, backgroundColor: languageColor(lang.name) }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}

      {/* Top repos */}
      {gh.topRepos && gh.topRepos.length > 0 && (
        <section>
          <Card>
            <p className="mb-4 flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-slate-500">
              <GitBranch className="h-3 w-3" /> Top repositories
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {gh.topRepos.slice(0, 12).map((r) => (
                <a
                  key={r.fullName}
                  href={`https://github.com/${r.fullName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5 transition-colors hover:border-border-2 hover:bg-surface-3"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {r.language && (
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: languageColor(r.language) }} />
                    )}
                    <span className="truncate font-mono text-xs text-slate-300 group-hover:text-slate-100">
                      {r.fullName.split('/')[1]}
                    </span>
                  </div>
                  {r.stargazersCount > 0 && (
                    <span className="flex shrink-0 items-center gap-1 text-[11px] text-slate-500">
                      <Star className="h-3 w-3" />{r.stargazersCount.toLocaleString()}
                    </span>
                  )}
                </a>
              ))}
            </div>
          </Card>
        </section>
      )}

      {/* CTA */}
      <footer className="rounded-xl border border-accent/20 bg-gradient-to-br from-accent/5 to-transparent px-6 py-8 text-center">
        <p className="text-base font-semibold text-slate-100">See your own developer story</p>
        <p className="mt-1.5 text-sm text-slate-400 max-w-sm mx-auto">
          Connect GitHub and get your commit streaks, language evolution, and contribution heatmap — all in one place.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent/20 hover:bg-accent/90 transition-colors"
        >
          Start tracking for free →
        </Link>
        <p className="mt-3 text-[11px] text-slate-600">Free plan · No credit card required</p>
      </footer>
    </div>
  )
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { username } = await params

  const [profile, platformStats] = await Promise.all([
    fetchDevPulseProfile(username),
    ssrGraphQL<{ platformStats: { userCount: number; commitCount: number } }>(
      PLATFORM_STATS_QUERY,
      {},
      { revalidate: 3600 },
    ).then((d) => d?.platformStats ?? null),
  ])

  if (!profile) {
    const gh = await fetchGitHubProfile(username)
    if (!gh) return <NotFoundState username={username} />
    return <GitHubProfilePage gh={gh} />
  }

  const initials = profile.displayName
    .split(/\s+/)
    .map((n) => n[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const showStreak = profile.currentStreak !== null && profile.longestStreak !== null
  const enoughUsers = (platformStats?.userCount ?? 0) >= 10
  const rankLabel = enoughUsers ? activeDaysLabel(profile.activeDays) : null
  const linesLabel = enoughUsers ? linesWrittenLabel(profile.totalAdditions) : null
  const prsRankLabel = enoughUsers ? prsLabel(profile.totalPrs) : null
  const intensityLabel = enoughUsers ? commitIntensityLabel(profile.avgCommitsPerActiveDay) : null
  // Only show commit share when there are enough users for it to be meaningful,
  // and cap at 100% to guard against data inconsistencies (e.g. untracked repo metrics).
  const commitSharePct =
    platformStats && platformStats.commitCount > 0 && platformStats.userCount >= 10
      ? Math.min((profile.totalCommits / platformStats.commitCount) * 100, 100).toFixed(1)
      : null

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:text-left">
        <Avatar className="h-24 w-24 ring-2 ring-accent/30">
          <AvatarImage src={profile.avatarUrl ?? undefined} alt={profile.displayName} />
          <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold tracking-tight text-slate-100 sm:text-4xl">
            {profile.displayName}
          </h1>
          <p className="mt-1 font-mono text-sm text-accent">@{profile.username}</p>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-slate-500 sm:justify-start">
            <Calendar className="h-3 w-3" />
            {joinedLabel(profile.joinedAt)}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
            <ShareButton username={profile.username} displayName={profile.displayName} totalCommits={profile.totalCommits} currentStreak={profile.currentStreak} activeDays={profile.activeDays} />
            <EmbedCardButton username={profile.username} />
          </div>
        </div>
      </section>

      {/* KPI tiles */}
      <section className={`grid gap-4 ${showStreak ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
        {showStreak && (
          <Card className="relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-[2px] bg-orange-500" />
            <p className="mb-3 flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-slate-500">
              <Flame className="h-3 w-3" /> Current streak
            </p>
            <div className="flex items-baseline gap-2">
              <span className="tabular text-4xl font-black text-orange-400">{profile.currentStreak}</span>
              <span className="text-sm text-slate-600">days</span>
            </div>
            <p className="mt-1 text-xs text-slate-600">Best: {profile.longestStreak} days</p>
          </Card>
        )}
        <Card className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-[2px] bg-accent" />
          <p className="mb-3 flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-slate-500">
            <Trophy className="h-3 w-3" /> Total commits
          </p>
          <div className="flex items-baseline gap-2">
            <span className="tabular text-4xl font-black text-slate-100">{formatNumber(profile.totalCommits)}</span>
          </div>
          <p className="mt-1 text-xs text-slate-600">All-time on tracked repos</p>
        </Card>
        <Card className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-[2px] bg-emerald-500" />
          <p className="mb-3 flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-slate-500">
            <Calendar className="h-3 w-3" /> Active days
          </p>
          <div className="flex items-baseline gap-2">
            <span className="tabular text-4xl font-black text-emerald-400">{profile.activeDays}</span>
            <span className="text-sm text-slate-600">/ 365</span>
          </div>
          <p className="mt-1 text-xs text-slate-600">Last 12 months</p>
        </Card>
      </section>

      {/* Secondary stats strip */}
      <section className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-surface px-4 py-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Lines written</p>
          <p className="mt-1 text-2xl font-black tabular-nums text-slate-100">{formatNumber(profile.totalAdditions)}</p>
          <p className="mt-0.5 text-[10px] text-slate-600">all time</p>
        </div>
        <div className="rounded-xl border border-border bg-surface px-4 py-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">PRs opened</p>
          <p className="mt-1 text-2xl font-black tabular-nums text-slate-100">{formatNumber(profile.totalPrs)}</p>
          <p className="mt-0.5 text-[10px] text-slate-600">all time</p>
        </div>
        <div className="rounded-xl border border-border bg-surface px-4 py-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Commits / active day</p>
          <p className="mt-1 text-2xl font-black tabular-nums text-slate-100">{profile.avgCommitsPerActiveDay}</p>
          <p className="mt-0.5 text-[10px] text-slate-600">avg intensity</p>
        </div>
      </section>

      {/* Ranking context badges */}
      {(rankLabel ?? linesLabel ?? prsRankLabel ?? intensityLabel ?? commitSharePct) && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {rankLabel && (
            <div className="flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/8 px-3 py-1 text-xs font-medium text-accent w-fit">
              <TrendingUp className="h-3 w-3" />
              {rankLabel} on reflog
            </div>
          )}
          {linesLabel && (
            <div className="flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/8 px-3 py-1 text-xs font-medium text-accent w-fit">
              <TrendingUp className="h-3 w-3" />
              {linesLabel} on reflog
            </div>
          )}
          {prsRankLabel && (
            <div className="flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/8 px-3 py-1 text-xs font-medium text-accent w-fit">
              <TrendingUp className="h-3 w-3" />
              {prsRankLabel} on reflog
            </div>
          )}
          {intensityLabel && (
            <div className="flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/8 px-3 py-1 text-xs font-medium text-accent w-fit">
              <TrendingUp className="h-3 w-3" />
              {intensityLabel} on reflog
            </div>
          )}
          {commitSharePct && (
            <div className="flex items-center gap-1.5 rounded-full border border-slate-700 bg-surface-2 px-3 py-1 text-xs font-medium text-slate-400 w-fit">
              {commitSharePct}% of all tracked commits
            </div>
          )}
        </div>
      )}

      {/* Heatmap */}
      <section>
        <Card>
          <p className="mb-4 text-xs font-medium uppercase tracking-widest text-slate-500">
            Contribution activity — last year
          </p>
          <Heatmap data={profile.recentActivity} />
        </Card>
      </section>

      {/* Top languages */}
      {profile.topLanguages.length > 0 && (
        <section>
          <Card>
            <p className="mb-4 flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-slate-500">
              <Code2 className="h-3 w-3" /> Top languages
            </p>
            <div className="space-y-3">
              {profile.topLanguages.map((lang) => (
                <div key={lang.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: languageColor(lang.name) }} />
                      <span className="text-slate-200 font-medium">{lang.name}</span>
                    </div>
                    <span className="tabular text-slate-500">{lang.percent.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${lang.percent}%`, backgroundColor: languageColor(lang.name) }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}

      {/* Tracked repos */}
      {profile.trackedRepos && profile.trackedRepos.length > 0 && (
        <section>
          <Card>
            <p className="mb-4 flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-slate-500">
              <GitBranch className="h-3 w-3" /> Public repositories ({profile.trackedRepos.length})
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {profile.trackedRepos.slice(0, 30).map((r) => (
                <a
                  key={r.fullName}
                  href={`https://github.com/${r.fullName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5 transition-colors hover:border-border-2 hover:bg-surface-3"
                >
                  <span className="truncate font-mono text-xs text-slate-300 group-hover:text-slate-100">
                    {r.fullName}
                  </span>
                  {r.language && (
                    <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-slate-500">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: languageColor(r.language) }} />
                      {r.language}
                    </span>
                  )}
                </a>
              ))}
            </div>
          </Card>
        </section>
      )}

      {/* CTA */}
      <footer className="rounded-xl border border-accent/20 bg-gradient-to-br from-accent/5 to-transparent px-6 py-8 text-center">
        <p className="text-base font-semibold text-slate-100">See your own developer story</p>
        <p className="mt-1.5 text-sm text-slate-400 max-w-sm mx-auto">
          Connect GitHub and get your commit streaks, language evolution, and contribution heatmap — all in one place.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent/20 hover:bg-accent/90 transition-colors"
        >
          Start tracking for free →
        </Link>
        <p className="mt-3 text-[11px] text-slate-600">Free plan · No credit card required</p>
      </footer>
    </div>
  )
}
