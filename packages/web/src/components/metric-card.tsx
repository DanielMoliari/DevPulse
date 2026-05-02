'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Area, AreaChart } from 'recharts'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, formatNumber } from '@/lib/utils'

interface MetricCardProps {
  title: string
  value: number | string
  unit?: string
  trend?: { value: number; direction: 'up' | 'down' | 'flat' }
  trendLabel?: string
  sparkline?: { value: number }[]
  loading?: boolean
  accent?: boolean
  className?: string
}

export function MetricCard({
  title,
  value,
  unit,
  trend,
  trendLabel = 'vs last week',
  sparkline,
  loading,
  accent,
  className,
}: MetricCardProps) {
  if (loading) {
    return (
      <Card className={className}>
        <Skeleton className="mb-3 h-3 w-24" />
        <Skeleton className="mb-2 h-8 w-16" />
        <Skeleton className="h-3 w-20" />
      </Card>
    )
  }

  const TrendIcon =
    trend?.direction === 'up' ? TrendingUp : trend?.direction === 'down' ? TrendingDown : Minus

  const trendColor =
    trend?.direction === 'up'
      ? 'text-success'
      : trend?.direction === 'down'
        ? 'text-danger'
        : 'text-slate-500'

  const displayValue =
    typeof value === 'number' ? formatNumber(value) : value

  return (
    <Card className={cn('relative overflow-hidden', className)}>
      {accent && (
        <div className="absolute inset-x-0 top-0 h-[2px] bg-accent" />
      )}
      <p className="mb-3 text-xs font-medium uppercase tracking-widest text-slate-500">{title}</p>
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="flex items-baseline gap-1">
            <span className="tabular text-3xl font-bold text-slate-100">{displayValue}</span>
            {unit && <span className="text-sm text-slate-500">{unit}</span>}
          </div>
          {trend && (
            <div className={cn('mt-1.5 flex items-center gap-1 text-xs', trendColor)}>
              <TrendIcon className="h-3 w-3" />
              <span className="tabular font-medium">{trend.value}%</span>
              <span className="text-slate-600">{trendLabel}</span>
            </div>
          )}
        </div>

        {sparkline && sparkline.length > 0 && (
          <div className="shrink-0">
            {/* Use explicit dimensions — ResponsiveContainer measures 0 on first paint inside flex parents */}
            <AreaChart width={96} height={48} data={sparkline} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#06b6d4"
                  strokeWidth={1.5}
                  fill="url(#sparkGrad)"
                  dot={false}
                  isAnimationActive={false}
                />
            </AreaChart>
          </div>
        )}
      </div>
    </Card>
  )
}
