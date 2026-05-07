'use client'

import { useMemo } from 'react'
import { useQuery } from '@apollo/client/react'
import { Flame, Trophy, Calendar, TrendingUp } from 'lucide-react'
import { StreakBadge } from '@/components/streak-badge'
import { Heatmap } from '@/components/heatmap'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { STREAK_QUERY, HEATMAP_QUERY, METRICS_QUERY } from '@/graphql/queries'
import type { StreakData, HeatmapDay, DailyMetrics } from '@/graphql/types'
import { formatDate, formatRelative, pluralize } from '@/lib/utils'

function yearRange() {
  // day-precision keys keep query variables stable across re-renders
  const to = new Date()
  to.setUTCHours(0, 0, 0, 0)
  const from = new Date(to)
  from.setUTCFullYear(from.getUTCFullYear() - 1)
  return { from: from.toISOString(), to: to.toISOString() }
}

export default function StreaksPage() {
  const yearVars = useMemo(() => yearRange(), [])
  const { data: streakData, loading: streakLoading } = useQuery<{ streak: StreakData }>(STREAK_QUERY)
  const { data: heatmapData, loading: heatmapLoading } = useQuery<{ heatmap: HeatmapDay[] }>(HEATMAP_QUERY)
  const { data: metricsData } = useQuery<{ metrics: DailyMetrics[] }>(METRICS_QUERY, {
    variables: yearVars,
  })

  const streak = streakData?.streak
  const heatmap = heatmapData?.heatmap ?? []
  const metrics = metricsData?.metrics ?? []

  const activeDays = metrics.filter((m: DailyMetrics) => m.commits > 0).length
  const totalCommits = metrics.reduce<number>((a, m) => a + m.commits, 0)
  const avgPerActiveDay = activeDays > 0 ? Math.round(totalCommits / activeDays) : 0

  // Find best streaks from heatmap
  const records = [
    {
      icon: Flame,
      label: 'Current streak',
      value: streak?.currentStreak ?? 0,
      unit: 'days',
      color: 'text-orange-400',
      bg: 'bg-orange-500/10',
    },
    {
      icon: Trophy,
      label: 'Longest streak',
      value: streak?.longestStreak ?? 0,
      unit: 'days',
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
    },
    {
      icon: Calendar,
      label: 'Active days',
      value: activeDays,
      unit: 'this year',
      color: 'text-accent',
      bg: 'bg-accent-dim',
    },
    {
      icon: TrendingUp,
      label: 'Avg commits',
      value: avgPerActiveDay,
      unit: 'per active day',
      color: 'text-success',
      bg: 'bg-success/10',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Hero streak display */}
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-orange-500/5 blur-3xl" />
        </div>
        <div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-widest text-slate-500">
              Current streak
            </p>
            {streakLoading ? (
              <Skeleton className="h-16 w-36" />
            ) : (
              <StreakBadge
                count={streak?.currentStreak ?? 0}
                size="lg"
                active={(streak?.currentStreak ?? 0) > 0}
              />
            )}
            {streak?.lastActiveDate && (
              <p className="mt-2 text-xs text-slate-600">
                Last active {formatRelative(streak.lastActiveDate)}
              </p>
            )}
          </div>

          <div className="flex gap-6">
            <div className="text-center">
              {streakLoading ? <Skeleton className="mx-auto h-8 w-16" /> : (
                <p className="tabular text-3xl font-black text-slate-100">{streak?.longestStreak ?? 0}</p>
              )}
              <p className="mt-0.5 text-xs text-slate-600">Longest</p>
            </div>
            <div className="text-center">
              {streakLoading ? <Skeleton className="mx-auto h-8 w-16" /> : (
                <p className="tabular text-3xl font-black text-slate-100">{activeDays}</p>
              )}
              <p className="mt-0.5 text-xs text-slate-600">Active days</p>
            </div>
            <div className="text-center">
              {streakLoading ? <Skeleton className="mx-auto h-8 w-16" /> : (
                <p className="tabular text-3xl font-black text-slate-100">{totalCommits}</p>
              )}
              <p className="mt-0.5 text-xs text-slate-600">Total commits</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {records.map(({ icon: Icon, label, value, unit, color, bg }) => (
          <Card key={label} className="relative">
            <div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-lg ${bg}`}>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            {streakLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <p className={`tabular text-2xl font-bold ${color}`}>{value}</p>
            )}
            <p className="mt-0.5 text-xs text-slate-600">{label}</p>
            <p className="text-[10px] text-slate-700">{unit}</p>
          </Card>
        ))}
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

      {/* Streak motivation */}
      {!streakLoading && (streak?.currentStreak ?? 0) === 0 && (
        <Card className="border-accent/20 bg-accent-dim">
          <div className="flex items-start gap-3">
            <Flame className="h-5 w-5 shrink-0 text-accent mt-0.5" />
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
