import type { Metadata } from 'next'
import Link from 'next/link'
import { Flame, GitBranch, Calendar, Code2, Trophy } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { Heatmap } from '@/components/heatmap'
import { EmbedCardButton } from '@/components/embed-card-button'
import { ssrGraphQL } from '@/lib/graphql-ssr'
import { formatNumber, languageColor } from '@/lib/utils'
import type { PublicProfile } from '@/graphql/types'

// Single GraphQL document used by both `generateMetadata` and the page itself.
// The Next.js fetch cache dedupes the second call inside a single request.
const PROFILE_QUERY = `
  query PublicProfile($username: String!) {
    publicProfile(username: $username) {
      username
      displayName
      avatarUrl
      joinedAt
      activeDays
      totalCommits
      currentStreak
      longestStreak
      topLanguages { name bytes percent }
      recentActivity { date count level }
      trackedRepos { fullName language }
    }
  }
`

interface PageProps {
  params: Promise<{ username: string }>
}

async function fetchProfile(username: string): Promise<PublicProfile | null> {
  const data = await ssrGraphQL<{ publicProfile: PublicProfile | null }>(
    PROFILE_QUERY,
    { username },
    { revalidate: 60 },
  )
  return data?.publicProfile ?? null
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params
  const profile = await fetchProfile(username)
  if (!profile) {
    return {
      title: 'Profile not found · DevPulse',
      description: 'This developer has not enabled a public DevPulse profile.',
    }
  }
  const streakBlurb = profile.currentStreak !== null && profile.currentStreak > 0
    ? `${profile.currentStreak}-day streak · `
    : ''
  const description = `${streakBlurb}${formatNumber(profile.totalCommits)} commits · ${profile.activeDays} active days in the last year`
  const title = `${profile.displayName} on DevPulse`
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      ...(profile.avatarUrl ? { images: [{ url: profile.avatarUrl }] } : {}),
    },
    twitter: {
      card: 'summary',
      title,
      description,
      ...(profile.avatarUrl ? { images: [profile.avatarUrl] } : {}),
    },
  }
}

function joinedLabel(iso: string): string {
  const d = new Date(iso)
  return `On DevPulse since ${d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
}

function NotFoundState({ username }: { username: string }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-surface-2">
        <GitBranch className="h-7 w-7 text-slate-500" />
      </div>
      <h1 className="text-2xl font-bold text-slate-100">No profile here</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-500">
        Either <span className="font-mono text-slate-300">@{username}</span> doesn&apos;t exist on DevPulse,
        or this developer hasn&apos;t made their profile public.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 rounded-md border border-border-2 bg-surface-2 px-4 py-2 text-sm text-slate-200 hover:bg-surface-3 transition-colors"
      >
        Track your own pulse with DevPulse
      </Link>
    </div>
  )
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { username } = await params
  const profile = await fetchProfile(username)

  if (!profile) {
    return <NotFoundState username={username} />
  }

  const initials = profile.displayName
    .split(/\s+/)
    .map((n) => n[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const showStreak = profile.currentStreak !== null && profile.longestStreak !== null

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
          <div className="mt-3 flex justify-center sm:justify-start">
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
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: languageColor(lang.name) }}
                      />
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
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: languageColor(r.language) }}
                      />
                      {r.language}
                    </span>
                  )}
                </a>
              ))}
            </div>
          </Card>
        </section>
      )}

      {/* Footer CTA */}
      <footer className="pt-6 pb-12 text-center">
        <p className="text-xs text-slate-600">
          Built with{' '}
          <Link href="/" className="text-accent hover:underline">
            DevPulse
          </Link>{' '}
          — track your own developer pulse
        </p>
      </footer>
    </div>
  )
}
