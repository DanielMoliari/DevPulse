import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Star, GitFork, CircleDot, Clock, ExternalLink,
  Code2, Users, Calendar, ArrowLeft, FileCode2,
} from 'lucide-react'
import { ssrGraphQL } from '@/lib/graphql-ssr'
import { formatNumber, formatRelative, languageColor } from '@/lib/utils'

const REPO_QUERY = `
  query SearchRepo($owner: String!, $repo: String!) {
    searchRepo(owner: $owner, repo: $repo) {
      fullName description primaryLanguage
      stars forks openIssues sizeKb totalFiles
      createdAt pushedAt homepage topics
      languages { name bytes percent }
      contributors { login avatarUrl contributions }
      weeklyCommits { week total }
      punchCard { day hour count }
      fileExtensions { ext count }
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
  totalFiles: number
  createdAt: string
  pushedAt: string
  homepage?: string
  topics: string[]
  languages: { name: string; bytes: number; percent: number }[]
  contributors: { login: string; avatarUrl?: string; contributions: number }[]
  weeklyCommits: { week: number; total: number }[]
  punchCard: { day: number; hour: number; count: number }[]
  fileExtensions: { ext: string; count: number }[]
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

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function PunchCardChart({ data }: { data: { day: number; hour: number; count: number }[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1)
  // Aggregate to day×hour grid
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
  for (const slot of data) {
    grid[slot.day]![slot.hour] = slot.count
  }
  // Peak slot
  const peak = data.reduce((best, s) => s.count > best.count ? s : best, data[0] ?? { day: 0, hour: 0, count: 0 })
  const peakLabel = peak.count > 0
    ? `${DAYS[peak.day]} ${peak.hour}:00 — ${peak.count} commits`
    : null

  return (
    <div>
      {peakLabel && (
        <p className="mb-3 text-xs text-slate-500">
          Peak: <span className="font-semibold text-slate-300">{peakLabel}</span>
        </p>
      )}
      <div className="overflow-x-auto">
        <div className="min-w-[480px]">
          {/* Hour labels */}
          <div className="mb-1 flex" style={{ paddingLeft: 32 }}>
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="flex-1 text-center text-[8px] text-slate-700">
                {h % 3 === 0 ? `${h}h` : ''}
              </div>
            ))}
          </div>
          {/* Grid rows */}
          {grid.map((hours, day) => (
            <div key={day} className="mb-0.5 flex items-center gap-1">
              <span className="w-7 shrink-0 text-right text-[9px] text-slate-600">{DAYS[day]}</span>
              <div className="flex flex-1 gap-0.5">
                {hours.map((count, hour) => {
                  const intensity = count > 0 ? 0.15 + (count / maxCount) * 0.85 : 0
                  return (
                    <div
                      key={hour}
                      title={count > 0 ? `${DAYS[day]} ${hour}:00 — ${count} commits` : undefined}
                      className="flex-1 rounded-[2px] cursor-default"
                      style={{
                        height: 12,
                        backgroundColor: count > 0 ? `rgba(99,102,241,${intensity})` : '#1e2124',
                      }}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CommitSparkline({ weeks, color }: { weeks: { week: number; total: number }[]; color: string }) {
  if (!weeks.length || weeks.every((w) => w.total === 0)) return null
  const max = Math.max(...weeks.map((w) => w.total), 1)
  const totalCommits = weeks.reduce((s, w) => s + w.total, 0)
  const activeWeeks = weeks.filter((w) => w.total > 0).length

  return (
    <div>
      <div className="mb-3 flex items-end justify-between">
        <div>
          <span className="text-3xl font-bold tabular-nums text-slate-100">{formatNumber(totalCommits)}</span>
          <span className="ml-2 text-xs text-slate-600">commits · last 52 weeks</span>
        </div>
        <span className="text-xs text-slate-600">{activeWeeks} active weeks</span>
      </div>
      <div className="flex items-end gap-px" style={{ height: 64 }}>
        {weeks.map((w, i) => {
          const h = w.total > 0 ? Math.max(3, (w.total / max) * 64) : 2
          const date = new Date(w.week * 1000)
          const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          return (
            <div
              key={i}
              title={`${label}: ${w.total} commits`}
              className="flex-1 rounded-sm cursor-default transition-opacity hover:opacity-100"
              style={{
                height: h,
                backgroundColor: w.total > 0 ? color : '#1e2124',
                opacity: w.total > 0 ? 0.5 + (w.total / max) * 0.5 : 1,
              }}
            />
          )
        })}
      </div>
      {/* Month labels */}
      <div className="mt-1 flex" style={{ height: 14 }}>
        {weeks.map((w, i) => {
          const d = new Date(w.week * 1000)
          const isFirstOfMonth = d.getDate() <= 7
          return (
            <div key={i} className="flex-1 text-[8px] text-slate-700 overflow-hidden">
              {isFirstOfMonth ? d.toLocaleDateString('en-US', { month: 'short' }) : ''}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LanguageBar({ languages }: { languages: RepoData['languages'] }) {
  return (
    <div className="space-y-3">
      {/* Segmented bar */}
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        {languages.map((l) => (
          <div
            key={l.name}
            style={{ width: `${l.percent}%`, backgroundColor: languageColor(l.name) }}
            title={`${l.name}: ${l.percent}%`}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
        {languages.map((l) => (
          <div key={l.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: languageColor(l.name) }} />
            <span className="text-xs text-slate-300 truncate">{l.name}</span>
            <span className="ml-auto font-mono text-xs text-slate-500 tabular-nums shrink-0">
              {l.percent}%
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between text-[11px] text-slate-700">
        <span>{formatNumber(languages.reduce((s, l) => s + l.bytes, 0))} bytes</span>
        <span>{languages.length} languages</span>
      </div>
    </div>
  )
}

function FileExtChart({ extensions, totalFiles }: { extensions: RepoData['fileExtensions']; totalFiles: number }) {
  const maxCount = extensions[0]?.count ?? 1
  return (
    <div className="space-y-2">
      {extensions.slice(0, 10).map((e) => (
        <div key={e.ext} className="flex items-center gap-3">
          <span className="w-10 shrink-0 font-mono text-[11px] text-slate-500 text-right">.{e.ext}</span>
          <div className="flex-1 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
            <div
              className="h-full rounded-full bg-slate-400/40"
              style={{ width: `${(e.count / maxCount) * 100}%` }}
            />
          </div>
          <span className="w-10 shrink-0 text-right font-mono text-[11px] text-slate-500 tabular-nums">
            {e.count}
          </span>
        </div>
      ))}
      <p className="pt-1 text-[11px] text-slate-700">{totalFiles.toLocaleString()} total files</p>
    </div>
  )
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

  const primaryColor = languageColor(data.primaryLanguage)
  const sizeLabel = data.sizeKb > 1024
    ? `${(data.sizeKb / 1024).toFixed(1)} MB`
    : `${data.sizeKb} KB`
  const ageYears = ((Date.now() - new Date(data.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 365)).toFixed(1)
  const hasPunchCard = data.punchCard.some((s) => s.count > 0)
  const hasActivity = data.weeklyCommits.some((w) => w.total > 0)

  return (
    <main className="min-h-screen bg-[#0f0f0f] text-slate-100">
      {/* Nav */}
      <nav className="sticky top-0 z-10 border-b border-white/[0.06] bg-[#0f0f0f]/90 backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-4 md:px-6">
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

      <div className="mx-auto max-w-5xl px-4 py-10 md:px-6 space-y-6">

        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-400 transition-colors">
          <ArrowLeft className="h-3 w-3" /> Search another repo
        </Link>

        {/* ── Hero header ── */}
        <div className="rounded-2xl border border-white/[0.06] bg-[#111] p-6 space-y-4">
          <div className="h-1 w-12 rounded-full" style={{ backgroundColor: primaryColor }} />

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-mono text-2xl font-bold">
                <span className="text-slate-500">{owner}/</span>
                <span className="text-slate-100">{repo}</span>
              </h1>
              {data.description && (
                <p className="mt-2 text-sm text-slate-400 leading-relaxed max-w-2xl">{data.description}</p>
              )}
            </div>
            {data.homepage && (
              <a
                href={data.homepage.startsWith('http') ? data.homepage : `https://${data.homepage}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-accent hover:underline shrink-0"
              >
                <ExternalLink className="h-3 w-3" />
                {data.homepage.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>

          {/* KPI stat pills */}
          <div className="flex flex-wrap gap-3">
            {[
              { icon: <Star className="h-3.5 w-3.5 text-yellow-500/80" />, value: formatNumber(data.stars), label: 'stars' },
              { icon: <GitFork className="h-3.5 w-3.5 text-slate-500" />, value: formatNumber(data.forks), label: 'forks' },
              { icon: <CircleDot className="h-3.5 w-3.5 text-emerald-500/70" />, value: data.openIssues, label: 'open issues' },
              { icon: <Code2 className="h-3.5 w-3.5 text-slate-500" />, value: sizeLabel, label: 'on disk' },
              { icon: <FileCode2 className="h-3.5 w-3.5 text-slate-500" />, value: data.totalFiles.toLocaleString(), label: 'files' },
              { icon: <Calendar className="h-3.5 w-3.5 text-slate-500" />, value: `${ageYears}y`, label: 'old' },
              { icon: <Clock className="h-3.5 w-3.5 text-slate-500" />, value: formatRelative(data.pushedAt), label: 'last push' },
            ].map(({ icon, value, label }) => (
              <div
                key={label}
                className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5"
              >
                {icon}
                <span className="font-semibold text-sm text-slate-200">{value}</span>
                <span className="text-xs text-slate-600">{label}</span>
              </div>
            ))}
          </div>

          {/* Topics */}
          {data.topics.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
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

        {/* ── Two-column grid: Languages + File breakdown ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">

          {/* Languages */}
          <div className="rounded-xl border border-white/[0.06] bg-[#111] p-5 space-y-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Languages</p>
              <p className="mt-0.5 text-xs text-slate-600">by bytes of code</p>
            </div>
            {data.languages.length > 0
              ? <LanguageBar languages={data.languages} />
              : <p className="text-xs text-slate-600">No language data</p>
            }
          </div>

          {/* File extension breakdown */}
          <div className="rounded-xl border border-white/[0.06] bg-[#111] p-5 space-y-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">File types</p>
              <p className="mt-0.5 text-xs text-slate-600">by extension count</p>
            </div>
            {data.fileExtensions.length > 0
              ? <FileExtChart extensions={data.fileExtensions} totalFiles={data.totalFiles} />
              : <p className="text-xs text-slate-600">No file data</p>
            }
          </div>
        </div>

        {/* ── Commit activity sparkline ── */}
        {hasActivity && (
          <div className="rounded-xl border border-white/[0.06] bg-[#111] p-5 space-y-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Commit activity</p>
              <p className="mt-0.5 text-xs text-slate-600">weekly, last 52 weeks</p>
            </div>
            <CommitSparkline weeks={data.weeklyCommits} color={primaryColor} />
          </div>
        )}

        {/* ── Punch card heatmap ── */}
        {hasPunchCard && (
          <div className="rounded-xl border border-white/[0.06] bg-[#111] p-5 space-y-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">When commits happen</p>
              <p className="mt-0.5 text-xs text-slate-600">day × hour heatmap — darker = more commits</p>
            </div>
            <PunchCardChart data={data.punchCard} />
          </div>
        )}

        {/* ── Contributors ── */}
        {data.contributors.length > 0 && (
          <div className="rounded-xl border border-white/[0.06] bg-[#111] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Contributors</p>
                <p className="mt-0.5 text-xs text-slate-600">by commit count</p>
              </div>
              <span className="flex items-center gap-1 text-xs text-slate-600">
                <Users className="h-3 w-3" /> {data.contributors.length} shown
              </span>
            </div>
            <div className="space-y-2">
              {data.contributors.map((c, i) => {
                const maxC = data.contributors[0]?.contributions ?? 1
                const pct = Math.round((c.contributions / maxC) * 100)
                return (
                  <div key={c.login} className="flex items-center gap-3">
                    <span className="w-4 shrink-0 text-right text-[10px] text-slate-700 tabular-nums">{i + 1}</span>
                    {c.avatarUrl ? (
                      <img src={c.avatarUrl} alt={c.login} className="h-7 w-7 shrink-0 rounded-full ring-1 ring-white/[0.08]" />
                    ) : (
                      <div className="h-7 w-7 shrink-0 rounded-full bg-white/[0.06] flex items-center justify-center text-[10px] text-slate-400 font-semibold">
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
                      <div className="w-24 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: primaryColor, opacity: 0.7 }}
                        />
                      </div>
                      <span className="w-14 text-right text-[11px] font-mono text-slate-500 tabular-nums">
                        {c.contributions.toLocaleString()} commits
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── CTA ── */}
        <div
          className="rounded-2xl border p-8 text-center"
          style={{ borderColor: `${primaryColor}33`, background: `${primaryColor}08` }}
        >
          <div
            className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${primaryColor}20` }}
          >
            <span className="text-lg">⚡</span>
          </div>
          <p className="text-sm font-semibold text-slate-200 mb-1">Track your repos on reflog</p>
          <p className="text-xs text-slate-500 mb-5 max-w-sm mx-auto">
            Commit streaks, language drift, code health scores — everything GitHub doesn't show you.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: primaryColor }}
          >
            Connect GitHub — it's free
          </Link>
        </div>

      </div>
    </main>
  )
}
