'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@apollo/client/react'
import { Flame, CheckCircle2, Target } from 'lucide-react'
import { StreakBadge } from '@/components/streak-badge'
import { Heatmap } from '@/components/heatmap'
import { ActivityChart } from '@/components/activity-chart'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { STREAK_QUERY, HEATMAP_QUERY, METRICS_QUERY } from '@/graphql/queries'
import type { StreakData, HeatmapDay, DailyMetrics } from '@/graphql/types'
import { formatRelative, pluralize } from '@/lib/utils'

function yearRange() {
  const to = new Date()
  to.setUTCHours(0, 0, 0, 0)
  const from = new Date(to)
  from.setUTCFullYear(from.getUTCFullYear() - 1)
  return { from: from.toISOString(), to: to.toISOString() }
}

type MetricRange = '7d' | '30d' | '90d' | 'all'
const METRIC_RANGES: { label: string; value: MetricRange; days: number | null }[] = [
  { label: '7 days',  value: '7d',  days: 7   },
  { label: '30 days', value: '30d', days: 30  },
  { label: '90 days', value: '90d', days: 90  },
  { label: 'All time',value: 'all', days: null },
]
function metricRangeVars(days: number | null) {
  const to = new Date()
  to.setUTCHours(23, 59, 59, 999)
  if (days === null) return { from: '2008-01-01T00:00:00.000Z', to: to.toISOString() }
  const from = new Date(to)
  from.setUTCDate(from.getUTCDate() - days)
  from.setUTCHours(0, 0, 0, 0)
  return { from: from.toISOString(), to: to.toISOString() }
}

export default function StreaksPage() {
  const yearVars = useMemo(() => yearRange(), [])
  const { data: streakData, loading: streakLoading } = useQuery<{ streak: StreakData }>(STREAK_QUERY)
  const { data: heatmapData, loading: heatmapLoading } = useQuery<{ heatmap: HeatmapDay[] }>(HEATMAP_QUERY)
  const { data: metricsData } = useQuery<{ metrics: DailyMetrics[] }>(METRICS_QUERY, {
    variables: yearVars,
  })

  const [metricRange, setMetricRange] = useState<MetricRange>('30d')
  const metricDays = METRIC_RANGES.find(r => r.value === metricRange)!.days
  const metricVars = useMemo(() => metricRangeVars(metricDays), [metricDays])
  const { data: deepMetrics, loading: deepLoading } = useQuery<{ metrics: DailyMetrics[] }>(
    METRICS_QUERY, { variables: metricVars }
  )
  const dm = deepMetrics?.metrics ?? []

  const streak = streakData?.streak
  const heatmap = heatmapData?.heatmap ?? []
  const metrics = metricsData?.metrics ?? []

  const activeDays = metrics.filter((m: DailyMetrics) => m.commits > 0).length
  const totalCommits = metrics.reduce<number>((a, m) => a + m.commits, 0)
  const totalLinesAdded = metrics.reduce<number>((a, m) => a + m.additions, 0)

  function formatLarge(n: number): string {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
    return String(n)
  }

  const MILESTONES = [7, 30, 60, 100]
  const currentStreak = streak?.currentStreak ?? 0
  const longestStreak = streak?.longestStreak ?? 0

  return (
    <div className="space-y-6">
      {/* Compact current streak row */}
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <span className="font-medium text-slate-400">Current streak</span>
        {streakLoading ? (
          <Skeleton className="h-5 w-16" />
        ) : (
          <StreakBadge count={currentStreak} size="sm" active={currentStreak > 0} />
        )}
        {streak?.lastActiveDate && (
          <>
            <span className="text-slate-700">·</span>
            <span>Last active {formatRelative(streak.lastActiveDate)}</span>
          </>
        )}
      </div>

      {/* Spotify Wrapped 2×2 stats grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Total commits — cyan */}
        <div className="rounded-xl border border-cyan-500/20 bg-gradient-to-br from-slate-900 to-slate-950 p-5">
          {streakLoading ? (
            <Skeleton className="h-10 w-24" />
          ) : (
            <p className="tabular text-4xl font-black text-cyan-400">{totalCommits}</p>
          )}
          <p className="mt-2 text-xs uppercase tracking-widest text-slate-500">commits this year</p>
        </div>

        {/* Longest streak — orange */}
        <div className="rounded-xl border border-orange-500/20 bg-gradient-to-br from-slate-900 to-slate-950 p-5">
          {streakLoading ? (
            <Skeleton className="h-10 w-24" />
          ) : (
            <p className="tabular text-4xl font-black text-orange-400">{longestStreak}</p>
          )}
          <p className="mt-2 text-xs uppercase tracking-widest text-slate-500">day best streak</p>
        </div>

        {/* Lines added — green */}
        <div className="rounded-xl border border-green-500/25 bg-gradient-to-br from-green-950/40 to-slate-950 p-5">
          {streakLoading ? (
            <Skeleton className="h-10 w-24" />
          ) : (
            <p className="tabular text-4xl font-black text-green-400">{formatLarge(totalLinesAdded)}</p>
          )}
          <p className="mt-2 text-xs uppercase tracking-widest text-slate-500">lines written</p>
        </div>

        {/* Active days — cyan/slate */}
        <div className="rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/30 to-slate-950 p-5">
          {streakLoading ? (
            <Skeleton className="h-10 w-24" />
          ) : (
            <p className="tabular text-4xl font-black text-slate-300">{activeDays}</p>
          )}
          <p className="mt-2 text-xs uppercase tracking-widest text-slate-500">days coding</p>
        </div>
      </div>

      {/* Contribution heatmap */}
      <Card>
        <CardHeader>
          <CardTitle>Contribution calendar</CardTitle>
          <p className="text-xs text-slate-600">
            {pluralize(activeDays, 'active day')} in the past year
          </p>
        </CardHeader>
        <CardContent>
          <Heatmap data={heatmap} loading={heatmapLoading} />
        </CardContent>
      </Card>

      {/* Milestone badges */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {MILESTONES.map((milestone) => {
          const achieved = longestStreak >= milestone
          const isNext = !achieved && currentStreak > 0
          const daysToGo = milestone - currentStreak

          let badgeClass: string
          let iconEl: React.ReactNode
          let statusLabel: string
          let labelClass: string

          if (achieved) {
            badgeClass = 'bg-green-500/10 border-green-500/20'
            iconEl = <CheckCircle2 className="h-5 w-5 text-green-400" />
            statusLabel = 'Achieved'
            labelClass = 'text-green-400'
          } else if (isNext) {
            badgeClass = 'bg-cyan-500/10 border-cyan-500/20'
            iconEl = <Target className="h-5 w-5 text-cyan-400" />
            statusLabel = `${daysToGo} day${daysToGo !== 1 ? 's' : ''} to go`
            labelClass = 'text-cyan-400'
          } else {
            badgeClass = 'bg-slate-800 border-slate-700'
            iconEl = <Target className="h-5 w-5 text-slate-600" />
            statusLabel = 'Locked'
            labelClass = 'text-slate-600'
          }

          return (
            <div
              key={milestone}
              className={`flex flex-col items-center gap-2 rounded-xl border p-4 ${badgeClass}`}
            >
              {iconEl}
              <p className="text-sm font-semibold text-slate-300">{milestone} days</p>
              <p className={`text-xs ${labelClass}`}>{statusLabel}</p>
            </div>
          )
        })}
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h3 className="text-sm font-semibold text-slate-300">Activity over time</h3>
          <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
            {METRIC_RANGES.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setMetricRange(value)}
                className={`cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  metricRange === value ? 'bg-surface-2 text-slate-100' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Commits</CardTitle></CardHeader>
            <CardContent>
              <ActivityChart data={dm.map(m => ({ date: m.date, value: m.commits }))} type="area" height={180} loading={deepLoading} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>PRs merged</CardTitle></CardHeader>
            <CardContent>
              <ActivityChart data={dm.map(m => ({ date: m.date, value: m.prsMerged }))} type="bar" color="#a78bfa" height={180} loading={deepLoading} />
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Net lines of code</CardTitle></CardHeader>
            <CardContent>
              <ActivityChart data={dm.map(m => ({ date: m.date, value: m.netLines }))} type="bar" color="#22c55e" height={180} loading={deepLoading} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Churn ratio</CardTitle></CardHeader>
            <CardContent>
              <ActivityChart data={dm.map(m => ({ date: m.date, value: Math.round((m.churnRatio ?? 0) * 100) }))} type="line" color="#f59e0b" height={180} formatValue={(v) => `${v}%`} loading={deepLoading} />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Streak motivation — only when no active streak */}
      {!streakLoading && currentStreak === 0 && (
        <Card className="border-accent/20 bg-accent-dim">
          <div className="flex items-start gap-3">
            <Flame className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
            <div>
              <p className="font-medium text-slate-100">Start your streak today</p>
              <p className="mt-0.5 text-sm text-slate-400">
                Make a commit to any tracked repository to begin a new streak. Consistency compounds.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
