import type { Metadata } from 'next'
import Link from 'next/link'
import { Star, GitFork, CircleDot, Clock, ExternalLink, Code2, Users, Calendar, ArrowLeft } from 'lucide-react'
import { ssrGraphQL } from '@/lib/graphql-ssr'
import { formatNumber, formatRelative, languageColor } from '@/lib/utils'

const REPO_QUERY = `
  query SearchRepo($owner: String!, $repo: String!) {
    searchRepo(owner: $owner, repo: $repo) {
      fullName description primaryLanguage
      stars forks openIssues sizeKb
      createdAt pushedAt homepage topics
      languages { name bytes percent }
      contributors { login avatarUrl contributions }
      weeklyCommits { week total }
    }
  }
`

interface RepoData {
  fullName: string
  description?: string
  primaryLanguage?: string
  stars: number
  forks: number
  openIssues: number
  sizeKb: number
  createdAt: string
  pushedAt: string
  homepage?: string
  topics: string[]
  languages: { name: string; bytes: number; percent: number }[]
  contributors: { login: string; avatarUrl?: string; contributions: number }[]
  weeklyCommits: { week: number; total: number }[]
}

interface PageProps {
  params: Promise<{ owner: string; repo: string }>
}

async function fetchRepo(owner: string, repo: string): Promise<RepoData | null> {
  const res = await ssrGraphQL<{ searchRepo: RepoData | null }>(REPO_QUERY, { owner, repo })
  return res?.searchRepo ?? null
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { owner, repo } = await params
  const data = await fetchRepo(owner, repo)
  if (!data) return { title: `${owner}/${repo} — reflog` }
  return {
    title: `${data.fullName} — reflog`,
    description: data.description ?? `Repository analysis for ${data.fullName}`,
  }
}

export default async function RepoPage({ params }: PageProps) {
  const { owner, repo } = await params
  const data = await fetchRepo(owner, repo)

  if (!data) {
    return (
      <main className="min-h-screen bg-[#0f0f0f] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-4xl font-bold text-slate-700 mb-3">404</p>
          <p className="text-slate-400 mb-1">Repository not found</p>
          <p className="text-sm text-slate-600 mb-6 font-mono">{owner}/{repo}</p>
          <Link href="/" className="text-accent text-sm hover:underline">← Back to reflog</Link>
        </div>
      </main>
    )
  }

  const totalBytes = data.languages.reduce((s, l) => s + l.bytes, 0)
  const primaryColor = languageColor(data.primaryLanguage)

  // Build commit sparkline from last 26 weeks
  const weeks = data.weeklyCommits.slice(-26)
  const maxCommits = Math.max(...weeks.map((w) => w.total), 1)

  // Format size
  const sizeLabel = data.sizeKb > 1024
    ? `${(data.sizeKb / 1024).toFixed(1)} MB`
    : `${data.sizeKb} KB`

  return (
    <main className="min-h-screen bg-[#0f0f0f] text-slate-100">
      {/* Nav bar */}
      <nav className="sticky top-0 z-10 border-b border-white/[0.06] bg-[#0f0f0f]/90 backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-4xl items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <span className="text-accent">⚡</span> reflog
          </Link>
          <Link
            href={`https://github.com/${data.fullName}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            View on GitHub <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-4xl px-4 py-10 md:px-6 space-y-8">

        {/* Back link */}
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-400 transition-colors">
          <ArrowLeft className="h-3 w-3" /> Search another repo
        </Link>

        {/* Header */}
        <div className="space-y-4">
          {/* Language accent bar */}
          <div
            className="h-1 w-16 rounded-full"
            style={{ backgroundColor: primaryColor }}
          />

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-mono text-2xl font-bold text-slate-100">
                <span className="text-slate-500">{owner}/</span>{repo}
              </h1>
              {data.description && (
                <p className="mt-2 text-sm text-slate-400 leading-relaxed max-w-xl">{data.description}</p>
              )}
            </div>

            {data.homepage && (
              <a
                href={data.homepage.startsWith('http') ? data.homepage : `https://${data.homepage}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-accent hover:underline shrink-0"
              >
                <ExternalLink className="h-3 w-3" /> {data.homepage.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
            <span className="flex items-center gap-1.5">
              <Star className="h-4 w-4 text-yellow-500/70" />
              <span className="font-semibold text-slate-200">{formatNumber(data.stars)}</span> stars
            </span>
            <span className="flex items-center gap-1.5">
              <GitFork className="h-4 w-4 text-slate-500" />
              <span className="font-semibold text-slate-200">{formatNumber(data.forks)}</span> forks
            </span>
            <span className="flex items-center gap-1.5">
              <CircleDot className="h-4 w-4 text-emerald-500/70" />
              <span className="font-semibold text-slate-200">{data.openIssues}</span> open issues
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <Code2 className="h-4 w-4" /> {sizeLabel}
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <Clock className="h-4 w-4" /> pushed {formatRelative(data.pushedAt)}
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <Calendar className="h-4 w-4" /> created {new Date(data.createdAt).getFullYear()}
            </span>
          </div>

          {/* Topics */}
          {data.topics.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {data.topics.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-accent/20 bg-accent/10 px-2.5 py-0.5 text-[11px] font-medium text-accent"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Commit activity sparkline */}
        {weeks.some((w) => w.total > 0) && (
          <section className="rounded-xl border border-white/[0.06] bg-[#111] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Commit activity</p>
                <p className="mt-0.5 text-xs text-slate-500">Last 26 weeks</p>
              </div>
              <p className="text-2xl font-bold tabular-nums text-slate-100">
                {formatNumber(weeks.reduce((s, w) => s + w.total, 0))}
                <span className="ml-1 text-xs font-normal text-slate-600">commits</span>
              </p>
            </div>
            <div className="flex items-end gap-0.5 h-14">
              {weeks.map((w) => {
                const h = maxCommits > 0 ? Math.max(2, (w.total / maxCommits) * 56) : 2
                const date = new Date(w.week * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                return (
                  <div
                    key={w.week}
                    title={`${date}: ${w.total} commits`}
                    className="flex-1 rounded-sm transition-opacity hover:opacity-80 cursor-default"
                    style={{ height: h, backgroundColor: w.total > 0 ? primaryColor : '#1e2124', opacity: w.total > 0 ? 0.7 + (w.total / maxCommits) * 0.3 : 1 }}
                  />
                )
              })}
            </div>
          </section>
        )}

        {/* Languages */}
        {data.languages.length > 0 && (
          <section className="rounded-xl border border-white/[0.06] bg-[#111] p-5">
            <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-slate-600">Languages</p>

            {/* Full-width segmented bar */}
            <div className="flex h-2 w-full overflow-hidden rounded-full mb-4">
              {data.languages.map((l) => (
                <div
                  key={l.name}
                  style={{ width: `${l.percent}%`, backgroundColor: languageColor(l.name) }}
                  title={`${l.name}: ${l.percent}%`}
                />
              ))}
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
              {data.languages.map((l) => (
                <div key={l.name} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: languageColor(l.name) }} />
                  <span className="text-xs text-slate-300 truncate">{l.name}</span>
                  <span className="ml-auto text-xs font-mono text-slate-500 shrink-0">{l.percent}%</span>
                </div>
              ))}
            </div>

            {totalBytes > 0 && (
              <p className="mt-3 text-[11px] text-slate-700">
                {formatNumber(totalBytes)} bytes analysed
              </p>
            )}
          </section>
        )}

        {/* Contributors */}
        {data.contributors.length > 0 && (
          <section className="rounded-xl border border-white/[0.06] bg-[#111] p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Contributors</p>
              <span className="flex items-center gap-1 text-xs text-slate-600">
                <Users className="h-3 w-3" /> {data.contributors.length} shown
              </span>
            </div>
            <div className="space-y-2">
              {data.contributors.map((c, i) => {
                const maxContribs = data.contributors[0]?.contributions ?? 1
                const pct = Math.round((c.contributions / maxContribs) * 100)
                return (
                  <div key={c.login} className="flex items-center gap-3">
                    <span className="w-4 shrink-0 text-right text-[10px] text-slate-700 tabular-nums">{i + 1}</span>
                    {c.avatarUrl ? (
                      <img
                        src={c.avatarUrl}
                        alt={c.login}
                        className="h-6 w-6 shrink-0 rounded-full ring-1 ring-white/[0.08]"
                      />
                    ) : (
                      <div className="h-6 w-6 shrink-0 rounded-full bg-white/[0.06] flex items-center justify-center text-[10px] text-slate-400 font-semibold">
                        {c.login[0]?.toUpperCase()}
                      </div>
                    )}
                    <a
                      href={`/u/${c.login}`}
                      className="font-mono text-xs text-slate-400 hover:text-slate-200 transition-colors truncate"
                    >
                      {c.login}
                    </a>
                    <div className="ml-auto flex items-center gap-2 shrink-0">
                      <div className="w-20 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: primaryColor, opacity: 0.7 }}
                        />
                      </div>
                      <span className="w-12 text-right text-[11px] font-mono text-slate-500 tabular-nums">
                        {formatNumber(c.contributions)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* CTA */}
        <div className="rounded-xl border border-accent/20 bg-accent/5 p-6 text-center">
          <p className="text-sm font-semibold text-slate-200 mb-1">Track your own repos on reflog</p>
          <p className="text-xs text-slate-500 mb-4">Commit streaks, language trends, code health — all in one dashboard.</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90 transition-colors"
          >
            Connect GitHub — it's free
          </Link>
        </div>

      </div>
    </main>
  )
}
