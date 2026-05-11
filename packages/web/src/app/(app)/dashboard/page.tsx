'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation } from '@apollo/client/react'
import { MetricCard } from '@/components/metric-card'
import { Heatmap } from '@/components/heatmap'
import { ActivityChart } from '@/components/activity-chart'
import { ActivityRadial } from '@/components/activity-radial'
import { StreakBadge } from '@/components/streak-badge'
import { HourlyActivity } from '@/components/hourly-activity'
import { TechGraduationCard } from '@/components/tech-graduation-card'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { METRICS_QUERY, STREAK_QUERY, HEATMAP_QUERY, INSIGHTS_QUERY, HOURLY_ACTIVITY_QUERY, REPOSITORIES_QUERY, PERSONAL_RECORDS_QUERY } from '@/graphql/queries'
import { SYNC_REPOSITORY } from '@/graphql/mutations'
import type { DailyMetrics, HeatmapMetric, StreakData, HeatmapDay, Insights, Repository } from '@/graphql/types'
import { getTrend } from '@/lib/utils'
import { Coffee, Sparkles, Clock, Trophy, TrendingUp } from 'lucide-react'
import { useUpgradeModalStore } from '@/store/upgrade-modal-store'
import { OnboardingPrompt } from '@/components/onboarding-prompt'
import { StreakMilestoneCard } from '@/components/streak-milestone-card'
import { StreakAtRiskBanner } from '@/components/streak-at-risk-banner'
import { ME_QUERY } from '@/graphql/queries'
import type { User } from '@/graphql/types'

type Range = 'week' | 'month' | 'all'

const HEATMAP_MODES: { label: string; value: HeatmapMetric }[] = [
  { label: 'Commits', value: 'COMMITS' },
  { label: 'Lines',   value: 'LINES'   },
  { label: 'Churn',   value: 'CHURN'   },
  { label: 'PRs',     value: 'PRS'     },
]
const RANGES: { label: string; value: Range; kpiLabel: string; chartLabel: string }[] = [
  { label: 'This week',  value: 'week',  kpiLabel: 'this week',  chartLabel: 'last 14 days' },
  { label: 'This month', value: 'month', kpiLabel: 'this month', chartLabel: 'last 30 days' },
  { label: 'All time',   value: 'all',   kpiLabel: 'all-time',   chartLabel: 'full history' },
]

function dayBoundary(daysAgo = 0, endOfDay = false): Date {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - daysAgo)
  if (endOfDay) d.setUTCHours(23, 59, 59, 999)
  else d.setUTCHours(0, 0, 0, 0)
  return d
}

function rangeFor(r: Range) {
  const to = dayBoundary(0, true).toISOString() // end-of-day so today's commits are included
  if (r === 'all')   return { from: '2008-01-01T00:00:00.000Z', to }
  if (r === 'month') return { from: dayBoundary(29).toISOString(), to }
  return { from: dayBoundary(13).toISOString(), to } // week-on-week needs 14d for trend
}

function prevRangeFor(r: Range) {
  if (r === 'all') return null
  if (r === 'month') return { from: dayBoundary(59).toISOString(), to: dayBoundary(30).toISOString() }
  return { from: dayBoundary(13).toISOString(), to: dayBoundary(7).toISOString() }
}

function sum(rows: DailyMetrics[], key: keyof DailyMetrics): number {
  return rows.reduce((acc, r) => acc + (r[key] as number), 0)
}

export default function DashboardPage() {
  const openUpgradeModal = useUpgradeModalStore((s) => s.openModal)
  const [range, setRange] = useState<Range>('week')
  const [heatmapMetric, setHeatmapMetric] = useState<HeatmapMetric>('COMMITS')
  const [dismissedMilestones, setDismissedMilestones] = useState<number[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      return JSON.parse(localStorage.getItem('dismissed_milestones') ?? '[]') as number[]
    } catch { return [] }
  })

  function dismissMilestone(m: number) {
    const next = [...dismissedMilestones, m]
    setDismissedMilestones(next)
    localStorage.setItem('dismissed_milestones', JSON.stringify(next))
  }
  const meta = RANGES.find((r) => r.value === range)!

  const vars = useMemo(() => rangeFor(range), [range])
  const prevVars = useMemo(() => prevRangeFor(range), [range])
  const allTimeVars = useMemo(
    () => ({ from: '2008-01-01T00:00:00.000Z', to: dayBoundary(0, true).toISOString() }),
    [],
  )

  const { data: metricsData, loading: metricsLoading, refetch: refetchMetrics } = useQuery<{ metrics: DailyMetrics[] }>(
    METRICS_QUERY, { variables: vars, fetchPolicy: 'cache-and-network' },
  )
  const { data: prevData, refetch: refetchPrev } = useQuery<{ metrics: DailyMetrics[] }>(METRICS_QUERY, {
    variables: prevVars ?? vars,
    skip: prevVars === null,
    fetchPolicy: 'cache-and-network',
  })
  const { data: allTimeData, refetch: refetchAllTime } = useQuery<{ metrics: DailyMetrics[] }>(METRICS_QUERY, {
    variables: allTimeVars,
    fetchPolicy: 'cache-and-network',
  })
  const { data: streakData, loading: streakLoading, refetch: refetchStreak } = useQuery<{ streak: StreakData }>(STREAK_QUERY, { fetchPolicy: 'cache-and-network' })
  const { data: heatmapData, loading: heatmapLoading, refetch: refetchHeatmap } = useQuery<{ heatmap: HeatmapDay[] }>(
    HEATMAP_QUERY, { variables: { metric: heatmapMetric }, fetchPolicy: 'cache-and-network' },
  )
  const { data: insightsData, loading: insightsLoading, refetch: refetchInsights } = useQuery<{ insights: Insights }>(INSIGHTS_QUERY, { fetchPolicy: 'cache-and-network' })

  const { data: reposData, startPolling: startReposPolling, stopPolling: stopReposPolling } = useQuery<{ repositories: Repository[] }>(REPOSITORIES_QUERY)
  const { data: meData } = useQuery<{ me: User }>(ME_QUERY)
  const { refetch: refetchRecords } = useQuery<{
    personalRecords: {
      hasNewRecord: boolean
      commits: { today: number; allTimeBest: number; isRecord: boolean }
      additions: { today: number; allTimeBest: number; isRecord: boolean }
      netLines: { today: number; allTimeBest: number; isRecord: boolean }
    }
  }>(PERSONAL_RECORDS_QUERY, { fetchPolicy: 'cache-and-network' })
  const [syncRepository] = useMutation(SYNC_REPOSITORY)
  const [recordToast, setRecordToast] = useState<string | null>(null)

  // Silently trigger a background sync for any tracked repo not synced in the last 6 hours
  useEffect(() => {
    const repos = reposData?.repositories
    if (!repos) return
    const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000
    repos
      .filter((r) => r.isTracked && (r.lastSyncedAt === null || new Date(r.lastSyncedAt).getTime() < sixHoursAgo))
      .forEach((r) => { void syncRepository({ variables: { id: r.id } }) })
  }, [reposData, syncRepository])

  // Poll repos every 3s while any are syncing; refetch all charts when done
  const isSyncing = (reposData?.repositories ?? []).some((r) => r.isTracked && r.syncState === 'SYNCING')
  const prevIsSyncing = useRef(isSyncing)
  useEffect(() => {
    if (isSyncing) {
      startReposPolling(3000)
    } else {
      stopReposPolling()
      if (prevIsSyncing.current) {
        void refetchMetrics()
        void refetchPrev()
        void refetchAllTime()
        void refetchStreak()
        void refetchHeatmap()
        void refetchInsights()
        void refetchRecords().then((res) => {
          const pr = res.data?.personalRecords
          if (!pr?.hasNewRecord) return
          const records: string[] = []
          if (pr.commits.isRecord) records.push(`${pr.commits.today} commits`)
          if (pr.additions.isRecord) records.push(`${pr.additions.today.toLocaleString()} lines added`)
          if (pr.netLines.isRecord) records.push(`${pr.netLines.today.toLocaleString()} net lines`)
          setRecordToast(`New personal best: ${records.join(' · ')}`)
          setTimeout(() => setRecordToast(null), 7000)
        })
      }
    }
    prevIsSyncing.current = isSyncing
  }, [isSyncing, startReposPolling, stopReposPolling, refetchMetrics, refetchPrev, refetchAllTime, refetchStreak, refetchHeatmap, refetchInsights])

  const metrics = metricsData?.metrics ?? []
  const prev = prevData?.metrics ?? []
  const streak = streakData?.streak
  const allRepos = reposData?.repositories ?? []
  const trackedRepos = allRepos.filter((r) => r.isTracked)
  const hasTrackedRepos = trackedRepos.length > 0
  const isFree = meData?.me?.plan === 'FREE'
  const currentStreak = streak?.currentStreak ?? 0
  const MILESTONES = [7, 30, 60, 100, 200, 365]
  const hitMilestone = [...MILESTONES].reverse().find((m) => currentStreak >= m && !dismissedMilestones.includes(m)) ?? null
  const showMilestone = hitMilestone !== null

  // For week view we want the latest 7 days only as the KPI window
  const kpiSlice = range === 'week' ? metrics.slice(-7) : metrics
  const prevSlice = range === 'week' ? prev.slice(0, 7) : prev

  const commits = sum(kpiSlice, 'commits')
  const linesAdded = sum(kpiSlice, 'additions')
  const reviewsDone = sum(kpiSlice, 'reviewsDone')
  const activeDaysAllTime = (allTimeData?.metrics ?? []).filter((m) => m.commits > 0).length

  const sparkline = metrics.slice(-30).map((m) => ({ value: m.commits }))
  const reviewsSparkline = metrics.slice(-30).map((m) => ({ value: m.reviewsDone }))

  const showTrends = prevVars !== null
  const trend = (current: number, key: keyof DailyMetrics) =>
    showTrends ? getTrend(current, sum(prevSlice, key)) : undefined

  return (
    <div className="space-y-6">
      {/* Onboarding — shown when no repos tracked yet */}
      {!metricsLoading && !hasTrackedRepos && <OnboardingPrompt />}

      {/* Streak milestone celebration */}
      {showMilestone && (
        <StreakMilestoneCard
          streak={currentStreak}
          username={meData?.me?.username}
          onDismiss={() => dismissMilestone(hitMilestone!)}
        />
      )}

      {/* Streak at-risk warning — shown after 20:00 UTC when no commit today */}
      <StreakAtRiskBanner streak={streak} loading={streakLoading} />

      {/* Personal record toast */}
      {recordToast && (
        <div className="flex items-center gap-3 rounded-xl border border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 to-amber-500/5 px-4 py-3">
          <Trophy className="h-5 w-5 shrink-0 text-yellow-400" />
          <p className="text-sm font-medium text-yellow-200">{recordToast}</p>
        </div>
      )}

      {/* Range selector */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-base font-semibold text-slate-100">Overview</h2>
        <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          {RANGES.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setRange(value)}
              className={`cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                range === value ? 'bg-surface-2 text-slate-100' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards — Commits · Lines added · Reviews · Streak · Active days */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <MetricCard
          title={`Commits ${meta.kpiLabel}`}
          value={commits}
          {...(trend(commits, 'commits') ? { trend: trend(commits, 'commits')! } : {})}
          sparkline={sparkline}
          loading={metricsLoading}
          accent
        />
        <MetricCard
          title={`Lines added ${meta.kpiLabel}`}
          value={linesAdded}
          {...(getTrend(linesAdded, sum(prevSlice, 'additions')) && showTrends ? { trend: getTrend(linesAdded, sum(prevSlice, 'additions'))! } : {})}
          loading={metricsLoading}
        />
        <MetricCard
          title={`Reviews ${meta.kpiLabel}`}
          value={reviewsDone}
          {...(trend(reviewsDone, 'reviewsDone') ? { trend: trend(reviewsDone, 'reviewsDone')! } : {})}
          sparkline={reviewsSparkline}
          loading={metricsLoading}
        />
        <Card className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-[2px] bg-orange-500" />
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-slate-500">Current streak</p>
          {streakLoading ? (
            <Skeleton className="h-9 w-20" />
          ) : (
            <div className="flex items-end gap-3">
              <StreakBadge count={streak?.currentStreak ?? 0} size="lg" active={(streak?.currentStreak ?? 0) > 0} />
              <span className="mb-1.5 text-sm text-slate-600">days</span>
            </div>
          )}
        </Card>
        <Card className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-[2px] bg-cyan-500/60" />
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-slate-500">Active days</p>
          {metricsLoading ? (
            <Skeleton className="h-9 w-20" />
          ) : (
            <div className="flex items-end gap-3">
              <span className="text-3xl font-bold tabular-nums text-slate-100">{activeDaysAllTime}</span>
              <span className="mb-1.5 text-xs text-slate-600">all time</span>
            </div>
          )}
        </Card>
      </div>

      {/* FREE plan nudge — history limited to 90 days */}
      {isFree && hasTrackedRepos && (
        <div className="relative overflow-hidden rounded-2xl border border-accent/25 bg-gradient-to-br from-accent/8 via-surface to-surface">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/10 blur-3xl" />
          <div className="relative px-6 py-5 flex flex-col sm:flex-row items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-accent/30 bg-accent/10">
              <TrendingUp className="h-5 w-5 text-accent" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <p className="text-sm font-semibold text-slate-100">
                Você está vendo os últimos 90 dias de histórico
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                PRO desbloqueia todo o histórico — cada commit, linha e streak desde sempre.
              </p>
            </div>
            <button
              onClick={() => openUpgradeModal('Ver toda sua história de código')}
              className="shrink-0 cursor-pointer rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-accent/20 hover:bg-accent/90 transition-colors whitespace-nowrap"
            >
              Upgrade para PRO →
            </button>
          </div>
        </div>
      )}

      {/* ── Section divider: Contribution activity ── */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 whitespace-nowrap">Contribution activity</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Heatmap + Radial day-of-week */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px] lg:items-stretch">
        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle>Contribution Activity</CardTitle>
              <div className="flex gap-1">
                {HEATMAP_MODES.map(({ label, value }) => (
                  <button
                    key={value}
                    onClick={() => setHeatmapMetric(value)}
                    className={`cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide transition-colors ${
                      heatmapMetric === value
                        ? 'bg-accent/20 text-accent border border-accent/30'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-center">
            <Heatmap data={heatmapData?.heatmap ?? []} loading={heatmapLoading} metric={heatmapMetric} />
          </CardContent>
        </Card>
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Day-of-week rhythm</CardTitle>
            <p className="mt-1 text-xs text-slate-500">When the work actually happens</p>
          </CardHeader>
          <CardContent className="flex flex-1 items-center justify-center">
            {metricsLoading ? (
              <Skeleton className="h-[240px] w-[240px] rounded-full" />
            ) : (
              <ActivityRadial data={metrics.map((m) => ({ date: m.date, commits: m.commits }))} size={240} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Section divider: Personal insights ── */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 whitespace-nowrap">Personal insights</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Personal insights — what the user can't get from GitHub natively */}
      <PersonalInsights insights={insightsData?.insights} loading={insightsLoading} />

      {/* ── Section divider: Code metrics ── */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 whitespace-nowrap">Code metrics</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Recent activity chart */}
      <Card>
        <CardHeader>
          <CardTitle>Commits — {meta.chartLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          {metricsLoading ? (
            <Skeleton className="h-[220px] w-full" />
          ) : (
            <ActivityChart
              data={metrics.map((m) => ({ date: m.date, value: m.commits }))}
              type="area"
              height={220}
              yLabel="commits"
            />
          )}
        </CardContent>
      </Card>

      {/* Net lines + churn */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Net lines of code</CardTitle>
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-[180px] w-full" />
            ) : (
              <ActivityChart
                data={metrics.map((m) => ({ date: m.date, value: m.netLines }))}
                type="bar"
                color="#22c55e"
                height={180}
                yLabel="net lines"
              />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>PR throughput</CardTitle>
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-[180px] w-full" />
            ) : (
              <ActivityChart
                data={metrics.map((m) => ({ date: m.date, value: m.prsMerged }))}
                type="line"
                color="#a78bfa"
                height={180}
                yLabel="PRs merged"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── Personal insights ──────────────────────────────────────────────────────
// Three signals you can't get from GitHub Insights:
//   1. Productive-hour heatmap (when *you* commit, in UTC)
//   2. Burnout warning (only shown when atRisk = true; supportive tone, never alarmist)
//   3. Tech graduation moments (auto-detected language transitions over the years)
function PersonalInsights({ insights, loading }: { insights: Insights | undefined; loading: boolean }) {
  const { data: hourlyData, loading: hourlyLoading } = useQuery<{ hourlyActivity: { hours: number[]; peakHour: number; peakRatio: number } | null }>(
    HOURLY_ACTIVITY_QUERY,
  )

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[200px] rounded-xl" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Skeleton className="h-[180px] rounded-xl" />
          <Skeleton className="h-[180px] rounded-xl" />
          <Skeleton className="h-[180px] rounded-xl" />
        </div>
      </div>
    )
  }
  if (!insights) return null

  const { burnout, techGraduations } = insights
  const hourlyActivity = hourlyData?.hourlyActivity ?? null
  const hasHourly = !!hourlyActivity && hourlyActivity.hours.some((n) => n > 0)
  const hasBurnout = !!burnout && burnout.atRisk
  const hasGraduations = techGraduations.length > 0
  if (!hasHourly && !hasBurnout && !hasGraduations) return null

  return (
    <section className="space-y-4">
      {/* Productive hours — full width */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-accent" /> Productive hours
            </CardTitle>
            {!hourlyLoading && hasHourly && hourlyActivity && (
              <div className="flex items-center gap-4 text-[11px]">
                <span className="text-slate-500">
                  Peak at <span className="tabular font-semibold text-accent">{formatHour(hourlyActivity.peakHour)}</span>
                </span>
                <span className="tabular text-slate-600">
                  {hourlyActivity.peakRatio.toFixed(1)}× avg
                </span>
              </div>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {hourlyLoading ? 'Computing your commit patterns…' : 'When you actually commit · last year, UTC'}
          </p>
        </CardHeader>
        <CardContent>
          {hourlyLoading ? (
            <Skeleton className="h-[120px] w-full" />
          ) : hasHourly && hourlyActivity ? (
            <HourlyActivity hours={hourlyActivity.hours} peakHour={hourlyActivity.peakHour} height={120} />
          ) : (
            <div className="flex h-[120px] items-center justify-center text-xs text-slate-600">
              Not enough commit data yet — sync more repos
            </div>
          )}
        </CardContent>
      </Card>

      {/* Burnout alert — only when at risk */}
      {hasBurnout && (
        <Card className="relative overflow-hidden border-orange-500/30 bg-gradient-to-br from-orange-500/5 to-surface">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-orange-500/10 blur-2xl" />
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-300">
              <Coffee className="h-3.5 w-3.5" /> A gentle nudge
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-slate-200">{burnout.message}</p>
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex gap-3 text-[11px] text-slate-500">
                <span><span className="tabular font-semibold text-slate-200">{burnout.consecutiveDays}d</span> straight</span>
                <span className="text-slate-700">·</span>
                <span>net lines <span className="tabular font-semibold text-orange-300">{burnout.netLinesTrend > 0 ? '+' : ''}{burnout.netLinesTrend}%</span></span>
              </div>
              <button type="button" className="cursor-pointer rounded-md border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-xs font-medium text-orange-200 transition-colors hover:bg-orange-500/20">
                Take a day off?
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tech graduations — responsive grid, no wrapper card */}
      {hasGraduations && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Tech graduations</span>
            <span className="text-[11px] text-slate-700">· language transitions detected from your repo history</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {techGraduations.map((g) => (
              <TechGraduationCard
                key={`${g.from}-${g.to}-${g.year}`}
                from={g.from}
                to={g.to}
                year={g.year}
                message={g.message}
                confidence={g.confidence}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function formatHour(h: number): string {
  const period = h < 12 ? 'AM' : 'PM'
  const display = h % 12 === 0 ? 12 : h % 12
  return `${display}${period} UTC`
}
