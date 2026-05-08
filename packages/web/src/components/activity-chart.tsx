'use client'

import { useMemo } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  BarChart,
  AreaChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts'
import { GitCommit, GitPullRequest, BarChart2, TrendingUp, Activity } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'

interface ChartDataPoint {
  date: string
  value: number
  [key: string]: string | number
}

interface ActivityChartProps {
  data: ChartDataPoint[]
  type?: 'line' | 'bar' | 'area'
  color?: string
  height?: number
  loading?: boolean
  yLabel?: string
  formatValue?: (v: number) => string
  emptyTitle?: string
  emptyDescription?: string
}

function resolveEmpty(yLabel?: string): { icon: React.ReactNode; title: string; description: string } {
  const l = (yLabel ?? '').toLowerCase()
  if (l.includes('pr') || l.includes('pull'))
    return {
      icon: <GitPullRequest className="h-5 w-5" />,
      title: 'No PRs in this period',
      description: 'Open and merge pull requests to see your throughput here.',
    }
  if (l.includes('commit'))
    return {
      icon: <GitCommit className="h-5 w-5" />,
      title: 'No commits yet',
      description: 'Push code to your tracked repositories and your activity will appear here.',
    }
  if (l.includes('churn') || l.includes('line'))
    return {
      icon: <TrendingUp className="h-5 w-5" />,
      title: 'No code changes tracked',
      description: 'Churn data appears once you have commits with additions and deletions.',
    }
  if (l.includes('review'))
    return {
      icon: <BarChart2 className="h-5 w-5" />,
      title: 'No reviews yet',
      description: 'Review pull requests on GitHub and your activity will show up here.',
    }
  return {
    icon: <Activity className="h-5 w-5" />,
    title: 'No activity in this period',
    description: 'Data will appear once your repositories are synced.',
  }
}

function CustomTooltip({
  active,
  payload,
  label,
  fmtTip,
  formatValue,
  color,
  yLabel,
}: {
  active?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: readonly any[]
  label?: string | number
  fmtTip: (s: string) => string
  formatValue?: (v: number) => string
  color: string
  yLabel?: string
}) {
  if (!active || !payload?.length) return null
  const raw = Number(payload[0]?.value ?? 0)
  const formatted = formatValue ? formatValue(raw) : raw.toLocaleString('en-US')
  const metric = yLabel ?? 'Value'
  return (
    <div
      style={{
        background: '#0d1117',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 10,
        padding: '10px 14px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        minWidth: 140,
      }}
    >
      <p style={{ fontSize: 11, color: '#64748b', marginBottom: 8, fontWeight: 500 }}>
        {fmtTip(String(label ?? ''))}
      </p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: color,
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{formatted}</span>
        <span style={{ fontSize: 11, color: '#475569' }}>{metric}</span>
      </div>
    </div>
  )
}

function buildAxisFormatter(data: ChartDataPoint[]) {
  if (data.length === 0) return { fmt: () => '', fmtTip: () => '', interval: 0 as const }

  // Parse as UTC — dates from DB are "2026-05-07T00:00:00.000Z". Without timeZone:UTC
  // toLocaleDateString would shift the date back one day for users in UTC- timezones.
  const dates = data.map((d) => new Date(d.date))
  // Guard: if data isn't sorted, find true min/max
  const minTime = Math.min(...dates.map((d) => d.getTime()))
  const maxTime = Math.max(...dates.map((d) => d.getTime()))
  const spanDays = (maxTime - minTime) / 86_400_000
  const crossesYear = new Date(minTime).getUTCFullYear() !== new Date(maxTime).getUTCFullYear()

  let mode: 'day' | 'month' | 'year'
  if (spanDays <= 45) mode = 'day'
  else if (spanDays <= 730 && !crossesYear) mode = 'month'
  else mode = 'year'

  const fmt = (raw: string) => {
    const d = new Date(raw)
    if (mode === 'day') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
    if (mode === 'month') {
      const month = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
      return crossesYear ? `${month} '${String(d.getUTCFullYear()).slice(2)}` : month
    }
    return String(d.getUTCFullYear())
  }

  const fmtTip = (raw: string) => {
    const d = new Date(raw)
    return d.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
    })
  }

  const targetTicks = 7
  const interval = Math.max(0, Math.floor(data.length / targetTicks) - 1)

  return { fmt, fmtTip, interval }
}

export function ActivityChart({
  data,
  type = 'area',
  color = '#06b6d4',
  height = 220,
  loading,
  yLabel,
  formatValue,
  emptyTitle,
  emptyDescription,
}: ActivityChartProps) {
  const { fmt, fmtTip, interval } = useMemo(() => buildAxisFormatter(data), [data])
  const allZero = data.length > 0 && data.every((d) => d.value === 0)

  if (loading) return <Skeleton style={{ height }} className="w-full" />

  if (data.length === 0 || allZero) {
    const resolved = resolveEmpty(yLabel)
    return (
      <EmptyState
        icon={resolved.icon}
        title={emptyTitle ?? resolved.title}
        description={emptyDescription ?? resolved.description}
        variant="gradient"
        height={height}
      />
    )
  }

  const tickStyle = { fontSize: 11, fill: '#64748b' }
  const gridStyle = { stroke: 'rgba(255,255,255,0.04)', strokeDasharray: '3 3' }



  const xAxisProps = {
    dataKey: 'date' as const,
    tickFormatter: fmt,
    tick: tickStyle,
    axisLine: false,
    tickLine: false,
    dy: 8,
    interval,
    minTickGap: 24,
  }
  const yAxisProps = {
    tick: tickStyle,
    axisLine: false,
    tickLine: false,
    width: 40,
    tickFormatter: formatValue
      ? (v: number) => formatValue(v)
      : (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toString()),
    allowDecimals: false,
  }

  const sharedProps = {
    data,
    margin: { top: 8, right: 8, bottom: 0, left: 0 },
  }

  const TooltipNode = (
    <RechartsTooltip
      content={(props) => (
        <CustomTooltip
          {...props}
          fmtTip={fmtTip}
          formatValue={formatValue}
          color={color}
          yLabel={yLabel}
        />
      )}
      cursor={{ stroke: 'rgba(255,255,255,0.06)', strokeWidth: 1, fill: 'transparent' }}
    />
  )

  return (
    // onMouseDown prevents the SVG from receiving browser focus on click,
    // which is what causes the blue outline ring Recharts can't suppress internally.
    <div onMouseDown={(e) => e.preventDefault()} style={{ outline: 'none' }}>
      <ResponsiveContainer width="100%" height={height}>
        {type === 'bar' ? (
          <BarChart {...sharedProps}>
            <CartesianGrid vertical={false} {...gridStyle} />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            {TooltipNode}
            <Bar dataKey="value" fill={color} radius={[3, 3, 0, 0]} maxBarSize={32} />
          </BarChart>
        ) : type === 'line' ? (
          <LineChart {...sharedProps}>
            <CartesianGrid vertical={false} {...gridStyle} />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            {TooltipNode}
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: color, stroke: '#0d1117', strokeWidth: 2 }} />
          </LineChart>
        ) : (
          <AreaChart {...sharedProps}>
            <defs>
              <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} {...gridStyle} />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            {TooltipNode}
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#grad-${color.replace('#', '')})`}
              dot={false}
              activeDot={{ r: 4, fill: color, stroke: '#0d1117', strokeWidth: 2 }}
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}
