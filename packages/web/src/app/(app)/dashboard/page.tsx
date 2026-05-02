'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@apollo/client/react'
import { MetricCard } from '@/components/metric-card'
import { Heatmap } from '@/components/heatmap'
import { ActivityChart } from '@/components/activity-chart'
import { ActivityRadial } from '@/components/activity-radial'
import { StreakBadge } from '@/components/streak-badge'
import { HourlyActivity } from '@/components/hourly-activity'
import { TechGraduationCard } from '@/components/tech-graduation-card'
import { ShareProfileButton } from '@/components/share-profile-button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { METRICS_QUERY, STREAK_QUERY, HEATMAP_QUERY, INSIGHTS_QUERY } from '@/graphql/queries'
import type { DailyMetrics, StreakData, HeatmapDay, Insights } from '@/graphql/types'
import { getTrend } from '@/lib/utils'
import { Coffee, Sparkles, Clock } from 'lucide-react'

type Range = 'week' | 'month' | 'all'
const RANGES: { label: string; value: Range; kpiLabel: string; chartLabel: string }[] = [
  { label: 'This week',  value: 'week',  kpiLabel: 'this week',  chartLabel: 'last 14 days' },
  { label: 'This month', value: 'month', kpiLabel: 'this month', chartLabel: 'last 30 days' },
  { label: 'All time',   value: 'all',   kpiLabel: 'all-time',   chartLabel: 'full history' },
]

function dayBoundary(daysAgo = 0): Date {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - daysAgo)
  return d
}

function rangeFor(r: Range) {
  const to = dayBoundary(0).toISOString()
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
  const [range, setRange] = useState<Range>('week')
  const meta = RANGES.find((r) => r.value === range)!

  const vars = useMemo(() => rangeFor(range), [range])
  const prevVars = useMemo(() => prevRangeFor(range), [range])

  const { data: metricsData, loading: metricsLoading } = useQuery<{ metrics: DailyMetrics[] }>(
    METRICS_QUERY, { variables: vars },
  )
  const { data: prevData } = useQuery<{ metrics: DailyMetrics[] }>(METRICS_QUERY, {
    variables: prevVars ?? vars,
    skip: prevVars === null,
  })
  const { data: streakData, loading: streakLoading } = useQuery<{ streak: StreakData }>(STREAK_QUERY)
  const { data: heatmapData, loading: heatmapLoading } = useQuery<{ heatmap: HeatmapDay[] }>(HEATMAP_QUERY)
  const { data: insightsData, loading: insightsLoading } = useQuery<{ insights: Insights }>(INSIGHTS_QUERY)

  const metrics = metricsData?.metrics ?? []
  const prev = prevData?.metrics ?? []
  const streak = streakData?.streak

  // For week view we want the latest 7 days only as the KPI window
  const kpiSlice = range === 'week' ? metrics.slice(-7) : metrics
  const prevSlice = range === 'week' ? prev.slice(0, 7) : prev

  const commits = sum(kpiSlice, 'commits')
  const prs = sum(kpiSlice, 'prsMerged')
  const reviews = sum(kpiSlice, 'reviewsDone')

  const sparkline = metrics.slice(-30).map((m) => ({ value: m.commits }))

  const showTrends = prevVars !== null
  const trend = (current: number, key: keyof DailyMetrics) =>
    showTrends ? getTrend(current, sum(prevSlice, key)) : undefined

  return (
    <div className="space-y-6">
      {/* Range selector */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-base font-semibold text-slate-100">Overview</h2>
        <div className="flex items-center gap-2">
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
          <ShareProfileButton />
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          title={`Commits ${meta.kpiLabel}`}
          value={commits}
          {...(trend(commits, 'commits') ? { trend: trend(commits, 'commits')! } : {})}
          sparkline={sparkline}
          loading={metricsLoading}
          accent
        />
        <MetricCard
          title={`PRs merged ${meta.kpiLabel}`}
          value={prs}
          {...(trend(prs, 'prsMerged') ? { trend: trend(prs, 'prsMerged')! } : {})}
          loading={metricsLoading}
        />
        <MetricCard
          title={`Reviews done ${meta.kpiLabel}`}
          value={reviews}
          {...(trend(reviews, 'reviewsDone') ? { trend: trend(reviews, 'reviewsDone')! } : {})}
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
      </div>

      {/* Heatmap + Radial day-of-week */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Contribution Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <Heatmap data={heatmapData?.heatmap ?? []} loading={heatmapLoading} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Day-of-week rhythm</CardTitle>
            <p className="mt-1 text-xs text-slate-500">When the work actually happens</p>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            {metricsLoading ? (
              <Skeleton className="h-[320px] w-[320px] rounded-full" />
            ) : (
              <ActivityRadial data={metrics.map((m) => ({ date: m.date, commits: m.commits }))} size={320} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Personal insights — what the user can't get from GitHub natively */}
      <PersonalInsights insights={insightsData?.insights} loading={insightsLoading} />

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
  if (loading) {
    return (
      <div className="space-y-3">
        <h2 className="font-display text-base font-semibold text-slate-100">Personal insights</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
          <Skeleton className="h-[220px] rounded-xl" />
          <Skeleton className="h-[220px] rounded-xl" />
        </div>
      </div>
    )
  }
  if (!insights) return null

  const { hourlyActivity, burnout, techGraduations } = insights
  const hasHourly = !!hourlyActivity && hourlyActivity.hours.some((n) => n > 0)
  const hasBurnout = !!burnout && burnout.atRisk
  const hasGraduations = techGraduations.length > 0
  if (!hasHourly && !hasBurnout && !hasGraduations) return null

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base font-semibold text-slate-100">Personal insights</h2>
        <span className="text-[11px] uppercase tracking-widest text-slate-600">
          things GitHub won&apos;t tell you
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        {/* Productive hours */}
        {hasHourly ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-accent" /> Productive hours
              </CardTitle>
              <p className="mt-1 text-xs text-slate-500">
                When you actually commit · all-time, UTC
              </p>
            </CardHeader>
            <CardContent>
              <HourlyActivity hours={hourlyActivity.hours} peakHour={hourlyActivity.peakHour} />
              <div className="mt-3 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">
                  Peak at <span className="tabular font-semibold text-accent">{formatHour(hourlyActivity.peakHour)}</span>
                </span>
                <span className="tabular text-slate-600">
                  {hourlyActivity.peakRatio.toFixed(1)}× the average hour
                </span>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="hidden lg:block" />
        )}

        {/* Burnout — only when at risk; supportive copy */}
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
                  <span>
                    <span className="tabular font-semibold text-slate-200">{burnout.consecutiveDays}d</span> straight
                  </span>
                  <span className="text-slate-700">·</span>
                  <span>
                    net lines{' '}
                    <span className="tabular font-semibold text-orange-300">
                      {burnout.netLinesTrend > 0 ? '+' : ''}{burnout.netLinesTrend}%
                    </span>
                  </span>
                </div>
                <button
                  type="button"
                  className="cursor-pointer rounded-md border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-xs font-medium text-orange-200 transition-colors hover:bg-orange-500/20"
                >
                  Take a day off?
                </button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tech graduations — horizontal scroll of from→to cards */}
      {hasGraduations && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-accent" /> Tech graduations
            </CardTitle>
            <p className="mt-1 text-xs text-slate-500">
              Language transitions detected from your repo history
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 overflow-x-auto pb-2 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-2 [&::-webkit-scrollbar-track]:bg-transparent">
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
          </CardContent>
        </Card>
      )}
    </section>
  )
}

function formatHour(h: number): string {
  const period = h < 12 ? 'AM' : 'PM'
  const display = h % 12 === 0 ? 12 : h % 12
  return `${display}${period} UTC`
}
