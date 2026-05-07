'use client'

import { useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import type { HeatmapDay } from '@/graphql/types'

const CELL = 11
const GAP = 2
const STEP = CELL + GAP
const COLS = 53

const LEVEL_FILL = [
  '#1e2124',
  '#083344',
  '#0e7490',
  '#0891b2',
  '#06b6d4',
]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', '']

interface HeatmapProps {
  data: HeatmapDay[]
  loading?: boolean
}

interface Cell {
  date: string
  count: number
  level: number
}

export function Heatmap({ data, loading }: HeatmapProps) {
  const [tooltip, setTooltip] = useState<{ cx: number; cy: number; date: string; count: number } | null>(null)

  if (loading) {
    return <Skeleton className="h-[110px] w-full" />
  }

  const dateMap = new Map(data.map((d) => [d.date.split('T')[0]!, d]))

  // Build 53-week grid starting from the Sunday 53 weeks ago
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const msDay = 86_400_000
  const startSunday = new Date(today.getTime() - (52 * 7 + today.getDay()) * msDay)

  const weeks: (Cell | null)[][] = []
  const monthLabels: { col: number; label: string }[] = []
  let prevMonth = -1

  for (let col = 0; col < COLS; col++) {
    const week: (Cell | null)[] = []
    for (let row = 0; row < 7; row++) {
      const d = new Date(startSunday.getTime() + (col * 7 + row) * msDay)
      if (d > today) { week.push(null); continue }
      const key = d.toISOString().split('T')[0]!
      const hit = dateMap.get(key)
      week.push({ date: key, count: hit?.count ?? 0, level: hit?.level ?? 0 })
      if (row === 0) {
        const m = d.getMonth()
        if (m !== prevMonth) {
          monthLabels.push({ col, label: MONTHS[m]! })
          prevMonth = m
        }
      }
    }
    weeks.push(week)
  }

  const W = 28 + COLS * STEP
  const H = 20 + 7 * STEP

  return (
    <div className="relative overflow-x-auto">
      <svg
        width={W}
        height={H}
        className="block min-w-[740px]"
        onMouseLeave={() => setTooltip(null)}
      >
        {monthLabels.map(({ col, label }) => (
          <text
            key={`m-${col}`}
            x={28 + col * STEP}
            y={11}
            fontSize={9}
            fill="#475569"
          >
            {label}
          </text>
        ))}

        {DAY_LABELS.map((label, row) =>
          label ? (
            <text key={`d-${row}`} x={0} y={20 + row * STEP + CELL - 1} fontSize={9} fill="#475569">
              {label}
            </text>
          ) : null,
        )}

        {weeks.map((week, col) =>
          week.map((cell, row) =>
            cell ? (
              <rect
                key={`${col}-${row}`}
                x={28 + col * STEP}
                y={20 + row * STEP}
                width={CELL}
                height={CELL}
                rx={2}
                fill={LEVEL_FILL[cell.level] ?? LEVEL_FILL[0]}
                style={{ cursor: cell.count > 0 ? 'pointer' : 'default' }}
                onMouseEnter={() =>
                  setTooltip({ cx: 28 + col * STEP + CELL / 2, cy: 20 + row * STEP - 8, date: cell.date, count: cell.count })
                }
              />
            ) : null,
          ),
        )}
      </svg>

      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded border border-border-2 bg-surface-2 px-2 py-1 text-xs whitespace-nowrap"
          style={{ left: tooltip.cx, top: tooltip.cy }}
        >
          <span className="text-slate-400">{tooltip.date}</span>
          <span className="ml-2 font-mono text-accent">{tooltip.count} commits</span>
        </div>
      )}

      <div className="mt-2 flex items-center gap-1 justify-end">
        <span className="text-[10px] text-slate-600 mr-1">Less</span>
        {LEVEL_FILL.map((fill, i) => (
          <span
            key={i}
            className="inline-block rounded-sm"
            style={{ width: 10, height: 10, backgroundColor: fill }}
          />
        ))}
        <span className="text-[10px] text-slate-600 ml-1">More</span>
      </div>
    </div>
  )
}
