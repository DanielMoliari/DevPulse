'use client'

import { useQuery } from '@apollo/client/react'
import { MetricCard } from '@/components/metric-card'
import { Heatmap } from '@/components/heatmap'
import { ActivityChart } from '@/components/activity-chart'
import { StreakBadge } from '@/components/streak-badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { METRICS_QUERY, STREAK_QUERY, HEATMAP_QUERY } from '@/graphql/queries'
import type { DailyMetrics, StreakData, HeatmapDay } from '@/graphql/types'
import { getTrend } from '@/lib/utils'

function weekRange() {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - 13)
  return { from: from.toISOString(), to: to.toISOString() }
}

function prevWeekRange() {
  const to = new Date()
  to.setDate(to.getDate() - 7)
  const from = new Date(to)
  from.setDate(from.getDate() - 7)
  return { from: from.toISOString(), to: to.toISOString() }
}

function sum(rows: DailyMetrics[], key: keyof DailyMetrics): number {
  return rows.reduce((acc, r) => acc + (r[key] as number), 0)
}

export default function DashboardPage() {
  const range = weekRange()
  const prevRange = prevWeekRange()

  const { data: metricsData, loading: metricsLoading } = useQuery<{ metrics: DailyMetrics[] }>(
    METRICS_QUERY,
    { variables: { from: range.from, to: range.to } },
  )
  const { data: prevData } = useQuery<{ metrics: DailyMetrics[] }>(METRICS_QUERY, {
    variables: { from: prevRange.from, to: prevRange.to },
  })
  const { data: streakData, loading: streakLoading } = useQuery<{ streak: StreakData }>(STREAK_QUERY)
  const { data: heatmapData, loading: heatmapLoading } = useQuery<{ heatmap: HeatmapDay[] }>(HEATMAP_QUERY)

  const metrics = metricsData?.metrics ?? []
  const prev = prevData?.metrics ?? []
  const streak = streakData?.streak

  const currentWeek = metrics.slice(7)
  const prevWeek = prev.slice(0, 7)

  const commits = sum(currentWeek, 'commits')
  const prs = sum(currentWeek, 'prsMerged')
  const reviews = sum(currentWeek, 'reviewsDone')

  const sparkline = metrics.map((m) => ({ value: m.commits }))

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          title="Commits this week"
          value={commits}
          trend={getTrend(commits, sum(prevWeek, 'commits'))}
          sparkline={sparkline}
          loading={metricsLoading}
          accent
        />
        <MetricCard
          title="PRs merged"
          value={prs}
          trend={getTrend(prs, sum(prevWeek, 'prsMerged'))}
          loading={metricsLoading}
        />
        <MetricCard
          title="Reviews done"
          value={reviews}
          trend={getTrend(reviews, sum(prevWeek, 'reviewsDone'))}
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

      {/* Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle>Contribution Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <Heatmap data={heatmapData?.heatmap ?? []} loading={heatmapLoading} />
        </CardContent>
      </Card>

      {/* Recent activity chart */}
      <Card>
        <CardHeader>
          <CardTitle>Commits — last 14 days</CardTitle>
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
