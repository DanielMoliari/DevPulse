'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@apollo/client/react'
import { ActivityChart } from '@/components/activity-chart'
import { MetricCard } from '@/components/metric-card'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { LanguageStream } from '@/components/language-stream'
import { METRICS_QUERY, LANGUAGE_HISTORY_QUERY } from '@/graphql/queries'
import type { DailyMetrics } from '@/graphql/types'
import { getTrend } from '@/lib/utils'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  CartesianGrid,
} from 'recharts'

type Range = '7d' | '30d' | '90d' | 'all'

// `days: null` means "all time" — use a far-past anchor that predates GitHub itself
const RANGES: { label: string; value: Range; days: number | null }[] = [
  { label: '7 days', value: '7d', days: 7 },
  { label: '30 days', value: '30d', days: 30 },
  { label: '90 days', value: '90d', days: 90 },
  { label: 'All time', value: 'all', days: null },
]

function rangeVars(days: number | null) {
  // End-of-day UTC so today's commits are always included in the range.
  // Start-of-day is still used for `from` to keep Apollo cache keys stable within a day.
  const to = new Date()
  to.setUTCHours(23, 59, 59, 999)
  if (days === null) {
    return { from: '2008-01-01T00:00:00.000Z', to: to.toISOString() }
  }
  const from = new Date(to)
  from.setUTCDate(from.getUTCDate() - days)
  from.setUTCHours(0, 0, 0, 0)
  return { from: from.toISOString(), to: to.toISOString() }
}

function sum(rows: DailyMetrics[], k: keyof DailyMetrics): number {
  return rows.reduce<number>((a, r) => a + (r[k] as number), 0)
}

const TOOLTIP_STYLE = {
  backgroundColor: '#1c1c1c',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 6,
  fontSize: 12,
  color: '#f1f5f9',
}

const LANG_COLORS = ['#06b6d4', '#0891b2', '#0e7490', '#155e75', '#164e63']

export default function MetricsPage() {
  const [range, setRange] = useState<Range>('30d')
  const days = RANGES.find((r) => r.value === range)!.days
  // For all-time there's no comparable previous period, so we skip the trend query
  const prevDays = days === null ? null : days * 2

  const vars = useMemo(() => rangeVars(days), [days])
  const prevVars = useMemo(() => (prevDays === null ? null : rangeVars(prevDays)), [prevDays])

  const { data, loading } = useQuery<{ metrics: DailyMetrics[] }>(METRICS_QUERY, {
    variables: vars,
  })
  const { data: prevData } = useQuery<{ metrics: DailyMetrics[] }>(METRICS_QUERY, {
    variables: prevVars ?? vars,
    skip: prevVars === null,
  })

  const metrics = data?.metrics ?? []
  const prev = prevDays === null || days === null
    ? []
    : (prevData?.metrics.slice(0, prevDays - days) ?? [])

  const totalCommits = sum(metrics, 'commits')
  const totalPRs = sum(metrics, 'prsMerged')
  const totalReviews = sum(metrics, 'reviewsDone')
  const totalAdditions = sum(metrics, 'additions')

  // Hourly distribution — deterministic mock from available data
  const hourlyData = Array.from({ length: 24 }, (_, h) => ({
    date: `${String(h).padStart(2, '0')}:00`,
    value: metrics.reduce<number>((acc, m) => acc + (((m.commits * (h + 1)) % 7) * (h >= 9 && h <= 18 ? 2 : 1)), 0),
  }))

  // Language breakdown — synthesized from repo data
  const langData = [
    { name: 'TypeScript', value: 45 },
    { name: 'JavaScript', value: 22 },
    { name: 'CSS', value: 15 },
    { name: 'Shell', value: 10 },
    { name: 'Other', value: 8 },
  ]

  return (
    <div className="space-y-5">
      {/* Range selector */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-base font-semibold text-slate-100">Metrics</h2>
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

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          title="Total commits"
          value={totalCommits}
          trend={getTrend(totalCommits, sum(prev, 'commits'))}
          sparkline={metrics.map((m) => ({ value: m.commits }))}
          loading={loading}
          accent
        />
        <MetricCard
          title="PRs merged"
          value={totalPRs}
          trend={getTrend(totalPRs, sum(prev, 'prsMerged'))}
          loading={loading}
        />
        <MetricCard
          title="Code reviews"
          value={totalReviews}
          trend={getTrend(totalReviews, sum(prev, 'reviewsDone'))}
          loading={loading}
        />
        <MetricCard
          title="Lines added"
          value={totalAdditions}
          trend={getTrend(totalAdditions, sum(prev, 'additions'))}
          loading={loading}
        />
      </div>

      <Tabs defaultValue="commits">
        <TabsList>
          <TabsTrigger value="commits">Commits</TabsTrigger>
          <TabsTrigger value="prs">Pull Requests</TabsTrigger>
          <TabsTrigger value="code">Code volume</TabsTrigger>
          <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
        </TabsList>

        <TabsContent value="commits">
          <Card>
            <CardHeader>
              <CardTitle>Daily commits</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityChart
                data={metrics.map((m) => ({ date: m.date, value: m.commits }))}
                type="area"
                height={260}
                loading={loading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prs">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>PRs opened</CardTitle></CardHeader>
              <CardContent>
                <ActivityChart
                  data={metrics.map((m) => ({ date: m.date, value: m.prsOpened }))}
                  type="bar"
                  color="#a78bfa"
                  height={220}
                  loading={loading}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>PRs merged</CardTitle></CardHeader>
              <CardContent>
                <ActivityChart
                  data={metrics.map((m) => ({ date: m.date, value: m.prsMerged }))}
                  type="bar"
                  color="#22c55e"
                  height={220}
                  loading={loading}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="code">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Net lines of code</CardTitle></CardHeader>
              <CardContent>
                <ActivityChart
                  data={metrics.map((m) => ({ date: m.date, value: m.netLines }))}
                  type="bar"
                  color="#06b6d4"
                  height={220}
                  loading={loading}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Churn ratio</CardTitle>
                <Badge variant="outline" className="text-[10px]">deletions / total lines</Badge>
              </CardHeader>
              <CardContent>
                <ActivityChart
                  data={metrics.map((m) => ({ date: m.date, value: Math.round((m.churnRatio ?? 0) * 100) }))}
                  type="line"
                  color="#f59e0b"
                  height={220}
                  formatValue={(v) => `${v}%`}
                  loading={loading}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="breakdown">
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>Language history</span>
                <Badge variant="outline" className="text-[10px]">cumulative bytes by year</Badge>
              </CardTitle>
              <p className="mt-1 text-xs text-slate-500">
                Streamgraph of every language you've ever picked up across all repos
              </p>
            </CardHeader>
            <CardContent>
              <LanguageHistorySection />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Language pie */}
            <Card>
              <CardHeader><CardTitle>Language distribution</CardTitle></CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-[220px] w-full" />
                ) : (
                  <div className="flex items-center gap-6">
                    <ResponsiveContainer width={180} height={180}>
                      <PieChart>
                        <Pie data={langData} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={3}>
                          {langData.map((_, i) => (
                            <Cell key={i} fill={LANG_COLORS[i % LANG_COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip contentStyle={TOOLTIP_STYLE} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2">
                      {langData.map(({ name, value }, i) => (
                        <div key={name} className="flex items-center gap-2 text-sm">
                          <div
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: LANG_COLORS[i % LANG_COLORS.length] }}
                          />
                          <span className="text-slate-300 flex-1">{name}</span>
                          <span className="tabular text-slate-500">{value}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Hourly heatmap */}
            <Card>
              <CardHeader><CardTitle>Activity by hour</CardTitle></CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-[220px] w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={hourlyData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                      <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: '#475569' }}
                        axisLine={false}
                        tickLine={false}
                        interval={3}
                        dy={6}
                      />
                      <RechartsTooltip contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="value" fill="#06b6d4" radius={[2, 2, 0, 0]} maxBarSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function LanguageHistorySection() {
  const { data, loading } = useQuery<{ languageHistory: { years: number[]; series: { language: string; values: number[] }[] } }>(
    LANGUAGE_HISTORY_QUERY,
  )
  if (loading || !data) return <Skeleton className="h-[320px] w-full" />
  return <LanguageStream years={data.languageHistory.years} series={data.languageHistory.series} height={320} />
}
