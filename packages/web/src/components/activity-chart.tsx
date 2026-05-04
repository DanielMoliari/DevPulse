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
import { Skeleton } from '@/components/ui/skeleton'

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
}

const TOOLTIP_STYLE = {
  backgroundColor: '#0d1117',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 12,
  color: '#f1f5f9',
  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
}

function buildAxisFormatter(data: ChartDataPoint[]) {
  if (data.length === 0) return { fmt: () => '', fmtTip: () => '', interval: 0 as const }

  const dates = data.map((d) => new Date(d.date))
  const first = dates[0]!
  const last = dates[dates.length - 1]!
  const spanDays = (last.getTime() - first.getTime()) / 86_400_000
  const crossesYear = first.getUTCFullYear() !== last.getUTCFullYear()

  let mode: 'day' | 'month' | 'year'
  if (spanDays <= 45) mode = 'day'
  else if (spanDays <= 730 && !crossesYear) mode = 'month'
  else mode = 'year'

  const fmt = (raw: string) => {
    const d = new Date(raw)
    if (mode === 'day') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    if (mode === 'month') {
      const month = d.toLocaleDateString('en-US', { month: 'short' })
      return crossesYear ? `${month} '${String(d.getUTCFullYear()).slice(2)}` : month
    }
    return String(d.getUTCFullYear())
  }

  const fmtTip = (raw: string) => {
    const d = new Date(raw)
    return d.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
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
}: ActivityChartProps) {
  const { fmt, fmtTip, interval } = useMemo(() => buildAxisFormatter(data), [data])

  if (loading) return <Skeleton style={{ height }} className="w-full" />
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-border text-xs text-slate-600"
        style={{ height }}
      >
        No activity in this period
      </div>
    )
  }

  const tickStyle = { fontSize: 11, fill: '#64748b' }
  const gridStyle = { stroke: 'rgba(255,255,255,0.04)', strokeDasharray: '3 3' }

  const fmtVal = (v: unknown): [string, string] => {
    const n = Number(v ?? 0)
    return [formatValue ? formatValue(n) : n.toLocaleString('en-US'), '']
  }

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
    label: yLabel
      ? { value: yLabel, angle: -90, position: 'insideLeft' as const, fill: '#475569', fontSize: 11 }
      : undefined,
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
      contentStyle={TOOLTIP_STYLE}
      labelStyle={{ color: '#94a3b8', fontSize: 11, marginBottom: 4 }}
      itemStyle={{ color: '#f1f5f9', fontSize: 13, fontWeight: 600 }}
      formatter={fmtVal}
      labelFormatter={(label) => fmtTip(String(label ?? ''))}
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
