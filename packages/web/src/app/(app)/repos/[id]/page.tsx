'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useQuery, useMutation } from '@apollo/client/react'
import {
  ArrowLeft, ExternalLink, Star, GitFork, Eye, AlertCircle,
  Calendar, GitBranch, Scale, RefreshCw, Globe, Zap, Sparkles, Activity,
  HardDrive, Clock, TrendingUp, Layers, Share2, Info, FolderOpen, Flame,
} from 'lucide-react'
import { ActivityChart } from '@/components/activity-chart'
import { LanguageBar } from '@/components/language-bar'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { REPOSITORY_DETAIL_QUERY } from '@/graphql/queries'
import { SYNC_REPOSITORY } from '@/graphql/mutations'
import { formatRelative } from '@/lib/utils'

interface EcosystemConnection {
  repoFullName: string
  ecosystem: string
  sharedDeps: string[]
  sharedCount: number
  overlapScore: number
}

interface FileHotspot {
  path: string
  commits: number
  additions: number
  deletions: number
  churnRatio: number
}

interface PrImpactRow {
  number: number
  title: string
  state: string
  category: 'high-impact' | 'refactor' | 'patch'
  createdAt: string
  mergedAt: string | null
  filesChanged: number
  additions: number
  deletions: number
}

interface HealthBreakdown {
  churn: number
  consistency: number
  mergeRate: number
  cadence: number
}

interface CodeHealth {
  score: number
  grade: string
  breakdown: HealthBreakdown
}

interface RepoDetail {
  repositoryDetail: {
    repository: { id: string; fullName: string; language: string | null; isTracked: boolean; isPrivate: boolean; syncState: string; lastSyncedAt: string | null }
    description: string | null
    homepage: string | null
    defaultBranch: string
    stars: number; forks: number; watchers: number; openIssues: number; sizeKb: number
    createdAt: string
    pushedAt: string | null
    topics: string[]
    license: string | null
    totalBytes: number
    languages: { name: string; bytes: number; percent: number }[]
    recentMetrics: { id: string; date: string; commits: number; additions: number; deletions: number; prsMerged: number; netLines: number; churnRatio: number | null }[]
    curiosities: { label: string; value: string }[]
    health: CodeHealth | null
    prsDetail: PrImpactRow[] | null
    ecosystemConnections: EcosystemConnection[]
    fileOwnership: { ownedFiles: number; totalFiles: number; ownershipPercent: number } | null
    fileHotspots: FileHotspot[] | null
  }
}

const CURIOSITY_ICONS: Record<string, typeof Clock> = {
  'Repository age': Clock,
  'Code size': HardDrive,
  'Languages': Layers,
  'Commits in last 90d': Activity,
  'Most productive day': Sparkles,
  'Best single day': TrendingUp,
  'Avg commits per active day': Zap,
  'Consistency (90d)': Calendar,
  'Lines added (90d)': TrendingUp,
  'Lines removed (90d)': TrendingUp,
  'Stars · Forks · Watchers': Star,
  'Open issues': AlertCircle,
  'Default branch': GitBranch,
  'License': Scale,
  'Topics': Sparkles,
}

const ECOSYSTEM_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  npm:    { bg: 'bg-red-500/10',    text: 'text-red-400',    label: 'npm' },
  python: { bg: 'bg-blue-500/10',   text: 'text-blue-400',   label: 'Python' },
  go:     { bg: 'bg-teal-500/10',   text: 'text-teal-400',   label: 'Go' },
  rust:   { bg: 'bg-orange-500/10', text: 'text-orange-400', label: 'Rust' },
  php:    { bg: 'bg-purple-500/10', text: 'text-purple-400', label: 'PHP' },
}

function shortPath(full: string): string {
  const parts = full.split('/')
  if (parts.length <= 2) return full
  return `…/${parts.slice(-2).join('/')}`
}

type ChartRange = '30d' | '90d' | 'all'
const CHART_RANGES: { label: string; value: ChartRange }[] = [
  { label: '30d', value: '30d' },
  { label: '90d', value: '90d' },
  { label: 'All', value: 'all' },
]

export default function RepoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data, loading, refetch, startPolling, stopPolling } = useQuery<RepoDetail>(REPOSITORY_DETAIL_QUERY, { variables: { id } })
  const [syncRepo] = useMutation(SYNC_REPOSITORY)
  const [syncing, setSyncing] = useState(false)
  const [chartRange, setChartRange] = useState<ChartRange>('all')

  const syncState = data?.repositoryDetail?.repository?.syncState

  // Stop polling once the sync finishes
  useEffect(() => {
    if (syncing && syncState && syncState !== 'SYNCING') {
      stopPolling()
      setSyncing(false)
      void refetch()
    }
  }, [syncing, syncState, stopPolling, refetch])

  if (loading || !data) return <RepoDetailSkeleton />
  const d = data.repositoryDetail
  const r = d.repository
  const [owner, name] = r.fullName.split('/')

  const isPrivate = r.isPrivate

  const cutoffDays = chartRange === '30d' ? 30 : chartRange === '90d' ? 90 : null
  const filteredMetrics = cutoffDays
    ? d.recentMetrics.filter((m) => {
        const age = (Date.now() - new Date(m.date).getTime()) / (1000 * 60 * 60 * 24)
        return age <= cutoffDays
      })
    : d.recentMetrics

  async function handleSync() {
    setSyncing(true)
    await syncRepo({ variables: { id } })
    startPolling(2000)
  }

  return (
    <div className="space-y-6">
      {/* ─── Breadcrumb ─────────────────────────────────────────────────── */}
      <Link href="/repos" className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition-colors hover:text-slate-300">
        <ArrowLeft className="h-3 w-3" /> Back to repositories
      </Link>

      {/* ─── Hero ───────────────────────────────────────────────────────── */}
      <Card className="relative overflow-hidden border-border-2">
        <div className="pointer-events-none absolute right-0 top-0 h-48 w-96 rounded-full bg-accent/5 blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">{owner}</span>
                <span className="text-slate-700">/</span>
                <Badge variant={r.isTracked ? 'accent' : 'default'} className="text-[10px]">
                  {r.isTracked ? 'TRACKED' : 'UNTRACKED'}
                </Badge>
                {r.syncState === 'SYNCING' && <Badge variant="accent" className="text-[10px]">SYNCING</Badge>}
                {r.syncState === 'ERROR'   && <Badge variant="danger" className="text-[10px]">SYNC FAILED</Badge>}
                {d.health && (
                  <span title={`Code health: ${d.health.grade} (${d.health.score}/100)`}>
                    <HealthGradeBadge grade={d.health.grade} />
                  </span>
                )}
              </div>
              <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-100">{name}</h1>
              {d.description && (
                <p className="mt-2 max-w-2xl text-sm text-slate-400">{d.description}</p>
              )}
              {d.topics.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {d.topics.map((t) => (
                    <span key={t} className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
                <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing…' : 'Sync now'}
              </Button>
              <a
                href={`https://github.com/${r.fullName}`}
                target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-surface-2 hover:text-slate-100"
              >
                <ExternalLink className="h-3 w-3" /> View on GitHub
              </a>
            </div>
          </div>

          {r.lastSyncedAt && (
            <p className="mt-4 text-[11px] text-slate-600">
              Last synced {formatRelative(r.lastSyncedAt)} · default branch <span className="text-slate-400">{d.defaultBranch}</span>
            </p>
          )}
        </div>
      </Card>

      {/* ─── Quick stats — only for public repos ────────────────────────── */}
      {!isPrivate && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile icon={Star}        label="Stars"       value={d.stars}      color="amber" />
          <StatTile icon={GitFork}     label="Forks"       value={d.forks}      color="violet" />
          <StatTile icon={Eye}         label="Watchers"    value={d.watchers}   color="teal" />
          <StatTile icon={AlertCircle} label="Open issues" value={d.openIssues} color={d.openIssues > 0 ? 'orange' : 'slate'} />
        </div>
      )}

      {/* ─── Language breakdown ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-accent" /> Tech composition
          </CardTitle>
          <p className="mt-1 text-xs text-slate-500">
            Language byte counts pulled from GitHub's linguist analysis
          </p>
        </CardHeader>
        <CardContent>
          <LanguageBar languages={d.languages} totalBytes={d.totalBytes} />
        </CardContent>
      </Card>

      {/* ─── Activity charts ────────────────────────────────────────────── */}
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold text-slate-100">Activity</h2>
          <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
            {CHART_RANGES.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setChartRange(value)}
                className={`cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  chartRange === value ? 'bg-surface-2 text-slate-100' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Commits</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityChart
                data={filteredMetrics.map((m) => ({ date: m.date, value: m.commits }))}
                type="area"
                height={220}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Net lines of code</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityChart
                data={filteredMetrics.map((m) => ({ date: m.date, value: m.netLines }))}
                type="bar"
                color="#22c55e"
                height={220}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ─── Recent PRs ─────────────────────────────────────────────────── */}
      {d.prsDetail && d.prsDetail.length > 0 && (
        <PrTimelineSection prs={d.prsDetail.slice(0, 15)} />
      )}

      {/* ─── Code health ────────────────────────────────────────────────── */}
      {d.health && <CodeHealthSection health={d.health} />}

      {/* ─── Curiosities grid ───────────────────────────────────────────── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-slate-100">Insights & curiosities</h2>
          <span className="text-[11px] uppercase tracking-widest text-slate-600">computed from sync data</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {d.curiosities.map((c) => {
            const Icon = CURIOSITY_ICONS[c.label] ?? Sparkles
            return (
              <div
                key={c.label}
                className="group relative overflow-hidden rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent/30"
              >
                <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-accent/[0.03] blur-2xl transition-all group-hover:bg-accent/10" />
                <div className="relative">
                  <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10">
                    <Icon className="h-3.5 w-3.5 text-accent" />
                  </div>
                  <p className="text-[10px] font-medium uppercase tracking-widest text-slate-600">{c.label}</p>
                  <p className="mt-1 text-sm font-medium text-slate-100">{c.value}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ─── File hotspots ──────────────────────────────────────────────── */}
      {d.fileHotspots && d.fileHotspots.length > 0 && (
        <FileHotspotsSection hotspots={d.fileHotspots.slice(0, 10)} />
      )}

      {/* ─── Ecosystem connections ──────────────────────────────────────── */}
      {d.ecosystemConnections.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Share2 className="h-4 w-4 text-accent" />
            <h2 className="font-display text-base font-semibold text-slate-100">Ecosystem connections</h2>
            <span
              className="group relative cursor-default"
              title="Repos in your portfolio sharing the same dependencies"
            >
              <Info className="h-3.5 w-3.5 text-slate-600 transition-colors group-hover:text-slate-400" />
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {d.ecosystemConnections.map((conn) => {
              const eco = ECOSYSTEM_COLORS[conn.ecosystem] ?? { bg: 'bg-slate-500/10', text: 'text-slate-400', label: conn.ecosystem }
              const [connOwner, connName] = conn.repoFullName.split('/')
              return (
                <div
                  key={conn.repoFullName}
                  className="group relative overflow-hidden rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent/30"
                >
                  <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-accent/[0.03] blur-2xl transition-all group-hover:bg-accent/10" />
                  <div className="relative space-y-3">
                    {/* header row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-600">{connOwner}</p>
                        <a
                          href={`https://github.com/${conn.repoFullName}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-sm font-medium text-slate-100 hover:text-accent"
                        >
                          <span className="truncate">{connName}</span>
                          <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
                        </a>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${eco.bg} ${eco.text}`}>
                        {eco.label}
                      </span>
                    </div>

                    {/* shared dep count */}
                    <p className="text-xs text-slate-500">
                      <span className="font-medium text-slate-300">{conn.sharedCount}</span> shared {conn.sharedCount === 1 ? 'dependency' : 'dependencies'}
                    </p>

                    {/* dep pills */}
                    <div className="flex flex-wrap gap-1">
                      {conn.sharedDeps.slice(0, 3).map((dep) => (
                        <span key={dep} className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                          {dep}
                        </span>
                      ))}
                      {conn.sharedDeps.length > 3 && (
                        <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                          +{conn.sharedDeps.length - 3}
                        </span>
                      )}
                    </div>

                    {/* overlap bar */}
                    <div className="space-y-1">
                      <div className="h-1 w-full overflow-hidden rounded-full bg-surface-2">
                        <div
                          className="h-full rounded-full bg-accent transition-all"
                          style={{ width: `${Math.round(conn.overlapScore * 100)}%` }}
                        />
                      </div>
                      <p className="text-right text-[10px] text-slate-600">
                        {Math.round(conn.overlapScore * 100)}% overlap
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── Code ownership ─────────────────────────────────────────────── */}
      {d.fileOwnership && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-accent" /> Code ownership
            </CardTitle>
            <p className="mt-1 text-xs text-slate-500">Files where you are the top contributor</p>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-6">
              <div>
                <p className="font-display text-4xl font-bold tabular-nums text-slate-100">
                  {d.fileOwnership.ownedFiles}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  owned <span className="text-slate-400">out of {d.fileOwnership.totalFiles} tracked</span>
                </p>
              </div>
              <div className="flex-1">
                <div className="mb-1.5 flex items-center justify-between text-[11px]">
                  <span className="text-slate-600">Ownership</span>
                  <span className="font-medium text-slate-300">{d.fileOwnership.ownershipPercent}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${d.fileOwnership.ownershipPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Metadata footer ────────────────────────────────────────────── */}
      <Card>
        <div className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
          <MetaRow icon={Calendar} label="Created"  value={new Date(d.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />
          <MetaRow icon={Activity} label="Last push" value={d.pushedAt ? formatRelative(d.pushedAt) : '—'} />
          <MetaRow icon={HardDrive} label="Size"     value={d.sizeKb >= 1024 ? `${(d.sizeKb / 1024).toFixed(1)} MB` : `${d.sizeKb.toLocaleString()} KB`} />
          <MetaRow icon={Scale} label="License"      value={d.license ?? 'No license'} />
        </div>
        {d.homepage && (
          <a href={d.homepage} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-xs text-accent hover:underline">
            <Globe className="h-3 w-3" /> {d.homepage}
          </a>
        )}
      </Card>
    </div>
  )
}

// ─── PR Timeline ───────────────────────────────────────────────────────────

const CATEGORY_STYLES: Record<PrImpactRow['category'], { label: string; bg: string; text: string; border: string }> = {
  'high-impact': { label: 'High impact', bg: 'bg-accent/20',     text: 'text-accent',     border: 'border-accent/30'     },
  'refactor':    { label: 'Refactor',    bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
  'patch':       { label: 'Patch',       bg: 'bg-slate-500/10',  text: 'text-slate-400',  border: 'border-slate-500/20'  },
}

const STATE_STYLES: Record<string, { label: string; text: string }> = {
  merged: { label: 'Merged', text: 'text-emerald-400' },
  open:   { label: 'Open',   text: 'text-blue-400'    },
  closed: { label: 'Closed', text: 'text-red-400'     },
}

function PrTimelineSection({ prs }: { prs: PrImpactRow[] }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-base font-semibold text-slate-100">Recent PRs</h2>
        <span className="text-[11px] uppercase tracking-widest text-slate-600">last 90 days · up to 20</span>
      </div>
      <Card>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {prs.map((pr) => {
              const cat = CATEGORY_STYLES[pr.category]
              const stateStyle = STATE_STYLES[pr.state] ?? STATE_STYLES['closed']!
              return (
                <li key={pr.number} className="flex flex-wrap items-start gap-3 px-4 py-3 sm:flex-nowrap sm:items-center">
                  <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${cat.bg} ${cat.text} ${cat.border}`}>
                    {cat.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="font-mono text-[11px] text-slate-600 mr-1.5">#{pr.number}</span>
                    <span className="truncate text-xs font-medium text-slate-200">{pr.title}</span>
                  </div>
                  <span className={`shrink-0 text-[10px] font-semibold ${stateStyle.text}`}>
                    {stateStyle.label}
                  </span>
                  <div className="flex shrink-0 items-center gap-2 text-[11px] tabular-nums">
                    <span className="text-emerald-500">+{pr.additions}</span>
                    <span className="text-red-500">-{pr.deletions}</span>
                    <span className="text-slate-600">{pr.filesChanged}f</span>
                  </div>
                  <span className="shrink-0 text-[11px] text-slate-600">
                    {formatRelative(pr.mergedAt ?? pr.createdAt)}
                  </span>
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── File hotspots section ──────────────────────────────────────────────────

function FileHotspotsSection({ hotspots }: { hotspots: FileHotspot[] }) {
  const maxCommits = Math.max(...hotspots.map((h) => h.commits), 1)
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-400" />
          <h2 className="font-display text-base font-semibold text-slate-100">File hotspots</h2>
        </div>
        <span className="text-[11px] uppercase tracking-widest text-slate-600">last 90 days · top 10</span>
      </div>
      <Card>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {hotspots.map((h) => {
              const barWidth = Math.round((h.commits / maxCommits) * 100)
              const barColor =
                h.churnRatio >= 0.6
                  ? 'bg-red-500'
                  : h.churnRatio >= 0.3
                    ? 'bg-yellow-500'
                    : 'bg-emerald-500'
              return (
                <li key={h.path} className="px-4 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className="min-w-0 truncate font-mono text-xs text-slate-300"
                      title={h.path}
                    >
                      {shortPath(h.path)}
                    </span>
                    <div className="flex shrink-0 items-center gap-3 text-[11px] tabular-nums">
                      <span className="text-emerald-500">+{h.additions.toLocaleString()}</span>
                      <span className="text-red-400">-{h.deletions.toLocaleString()}</span>
                      <span className="rounded bg-accent/10 px-1.5 py-0.5 font-semibold text-accent">
                        {h.commits}c
                      </span>
                    </div>
                  </div>
                  <div className="mt-1.5 h-0.5 w-full overflow-hidden rounded-full bg-white/5">
                    <div
                      className={`h-full rounded-full ${barColor} transition-all duration-300`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Tiles ─────────────────────────────────────────────────────────────────

function StatTile({ icon: Icon, label, value, color }: {
  icon: typeof Star; label: string; value: number; color: 'amber' | 'violet' | 'teal' | 'orange' | 'slate'
}) {
  const palette = {
    amber:  { bg: 'bg-yellow-500/10', text: 'text-yellow-400' },
    violet: { bg: 'bg-violet-500/10', text: 'text-violet-400' },
    teal:   { bg: 'bg-accent/10',     text: 'text-accent' },
    orange: { bg: 'bg-orange-500/10', text: 'text-orange-400' },
    slate:  { bg: 'bg-slate-500/10',  text: 'text-slate-400' },
  }[color]

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className={`mb-2 flex h-7 w-7 items-center justify-center rounded-lg ${palette.bg}`}>
        <Icon className={`h-3.5 w-3.5 ${palette.text}`} />
      </div>
      <p className="tabular text-2xl font-bold text-slate-100">{value.toLocaleString()}</p>
      <p className="mt-0.5 text-[10px] font-medium uppercase tracking-widest text-slate-600">{label}</p>
    </div>
  )
}

function MetaRow({ icon: Icon, label, value }: { icon: typeof Calendar; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-slate-600" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-slate-600">{label}</p>
        <p className="truncate text-slate-300">{value}</p>
      </div>
    </div>
  )
}

// ─── Health components ─────────────────────────────────────────────────────

type Grade = 'A' | 'B' | 'C' | 'D' | 'F'

const GRADE_PALETTE: Record<Grade, { text: string; bg: string; border: string; bar: string }> = {
  A: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', bar: 'bg-emerald-500' },
  B: { text: 'text-teal-400',   bg: 'bg-teal-500/10',    border: 'border-teal-500/30',    bar: 'bg-teal-500' },
  C: { text: 'text-yellow-400', bg: 'bg-yellow-500/10',  border: 'border-yellow-500/30',  bar: 'bg-yellow-500' },
  D: { text: 'text-orange-400', bg: 'bg-orange-500/10',  border: 'border-orange-500/30',  bar: 'bg-orange-500' },
  F: { text: 'text-red-400',    bg: 'bg-red-500/10',     border: 'border-red-500/30',     bar: 'bg-red-500' },
}

function HealthGradeBadge({ grade }: { grade: string }) {
  const p = GRADE_PALETTE[(grade as Grade)] ?? GRADE_PALETTE['F']
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold tracking-widest ${p.bg} ${p.text} ${p.border}`}>
      {grade}
    </span>
  )
}

function CodeHealthSection({ health }: { health: CodeHealth }) {
  const grade = health.grade as Grade
  const p = GRADE_PALETTE[grade] ?? GRADE_PALETTE['F']

  const bars: { label: string; key: keyof HealthBreakdown; description: string }[] = [
    { label: 'Churn',       key: 'churn',       description: 'Deletions / total lines changed — lower churn is cleaner' },
    { label: 'Consistency', key: 'consistency', description: 'Active days vs repo lifetime' },
    { label: 'Merge rate',  key: 'mergeRate',   description: 'PRs merged vs PRs opened' },
    { label: 'Cadence',     key: 'cadence',     description: 'Weekly commit regularity (low variance = high score)' },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-accent" /> Code health
        </CardTitle>
        <p className="mt-1 text-xs text-slate-500">
          Weighted from churn · consistency · merge rate · cadence — computed from synced data
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className={`flex shrink-0 flex-col items-center justify-center rounded-2xl border p-6 ${p.bg} ${p.border}`}>
            <span className={`font-display text-6xl font-black leading-none ${p.text}`}>{grade}</span>
            <span className="mt-2 text-xs font-medium text-slate-400">{health.score} / 100</span>
          </div>
          <div className="flex-1 space-y-4">
            {bars.map(({ label, key, description }) => {
              const val = health.breakdown[key]
              return (
                <div key={key}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-300">{label}</span>
                    <span className="text-xs tabular-nums text-slate-500">{Math.round(val)}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                    <div className={`h-full rounded-full transition-all ${p.bar}`} style={{ width: `${val}%` }} />
                  </div>
                  <p className="mt-1 text-[10px] text-slate-600">{description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Skeleton ──────────────────────────────────────────────────────────────

function RepoDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-40" />
      <Card>
        <Skeleton className="mb-3 h-7 w-64" />
        <Skeleton className="h-4 w-full max-w-md" />
      </Card>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
      <Skeleton className="h-48 rounded-xl" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    </div>
  )
}
