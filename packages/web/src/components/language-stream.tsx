'use client'

import { useMemo, useState } from 'react'
import { languageColor } from '@/lib/utils'

interface Series {
  language: string
  values: number[]
}

interface LanguageStreamProps {
  years: number[]
  series: Series[]
  height?: number
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b}B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)}KB`
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)}MB`
  return `${(b / 1024 / 1024 / 1024).toFixed(1)}GB`
}

// Smooth SVG path through points using monotone cubic interpolation (visually like d3.curveMonotoneX)
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M${points[0]!.x},${points[0]!.y}`
  const path: string[] = [`M${points[0]!.x},${points[0]!.y}`]
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i]!
    const p1 = points[i + 1]!
    const cpx = (p0.x + p1.x) / 2
    path.push(`C${cpx},${p0.y} ${cpx},${p1.y} ${p1.x},${p1.y}`)
  }
  return path.join(' ')
}

export function LanguageStream({ years, series, height = 320 }: LanguageStreamProps) {
  const [hover, setHover] = useState<{ x: number; yearIdx: number } | null>(null)
  const [activeLang, setActiveLang] = useState<string | null>(null)

  const PAD = { top: 16, right: 24, bottom: 28, left: 24 }
  const W = 900 // viewBox width — scales responsively
  const H = height

  const layout = useMemo(() => {
    if (years.length === 0 || series.length === 0) return null

    // Stack the series — symmetric around midline (streamgraph-style)
    const stackTotals = years.map((_, i) => series.reduce((s, ser) => s + (ser.values[i] ?? 0), 0))
    const max = Math.max(...stackTotals, 1)

    const xScale = (i: number) => PAD.left + (i / Math.max(years.length - 1, 1)) * (W - PAD.left - PAD.right)
    const yScale = (v: number) => (v / max) * (H - PAD.top - PAD.bottom)
    const midY = PAD.top + (H - PAD.top - PAD.bottom) / 2

    const layers = series.map((ser) => {
      const offsets: number[] = years.map(() => 0)
      // Each series sits on top of the cumulative below
      return { language: ser.language, values: ser.values, offsets }
    })

    // Compute symmetric (wiggle-zero) baselines: half above, half below
    const halfBelow: number[] = years.map((_, i) => {
      const total = stackTotals[i] ?? 0
      return -yScale(total) / 2
    })

    const stacked = series.map((ser, layerIdx) => {
      const top: { x: number; y: number }[] = []
      const bottom: { x: number; y: number }[] = []
      for (let i = 0; i < years.length; i++) {
        const offsetBelow = halfBelow[i] ?? 0
        const accBefore = series.slice(0, layerIdx).reduce((s, prev) => s + (prev.values[i] ?? 0), 0)
        const yBottom = midY + offsetBelow + yScale(accBefore)
        const yTop = midY + offsetBelow + yScale(accBefore + (ser.values[i] ?? 0))
        const x = xScale(i)
        top.push({ x, y: yTop })
        bottom.push({ x, y: yBottom })
      }
      const pathTop = smoothPath(top)
      const pathBottomReversed = smoothPath(bottom.slice().reverse()).replace(/^M/, 'L')
      return { language: ser.language, path: `${pathTop} ${pathBottomReversed} Z`, top }
    })

    return { stacked, xScale, max, stackTotals, midY }
  }, [years, series, H])

  if (!layout || years.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-border text-xs text-slate-600"
        style={{ height }}
      >
        Not enough history yet — sync more repos
      </div>
    )
  }

  const yearStep = Math.max(1, Math.ceil(years.length / 8))

  return (
    <div className="space-y-3">
      <div className="relative" style={{ height }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-full w-full"
          onMouseMove={(e) => {
            const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
            const xPx = ((e.clientX - rect.left) / rect.width) * W
            const xData = (xPx - PAD.left) / (W - PAD.left - PAD.right)
            const idx = Math.round(xData * (years.length - 1))
            if (idx >= 0 && idx < years.length) setHover({ x: xPx, yearIdx: idx })
          }}
          onMouseLeave={() => setHover(null)}
        >
          {/* Subtle midline glow */}
          <defs>
            {layout.stacked.map((l) => (
              <linearGradient key={l.language} id={`stream-${l.language}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={languageColor(l.language)} stopOpacity="0.95" />
                <stop offset="100%" stopColor={languageColor(l.language)} stopOpacity="0.65" />
              </linearGradient>
            ))}
          </defs>

          {/* X axis ticks */}
          {years.map((y, i) =>
            i % yearStep === 0 || i === years.length - 1 ? (
              <text
                key={y}
                x={layout.xScale(i)}
                y={H - 8}
                textAnchor="middle"
                fontSize="10"
                fill="#475569"
                fontFamily="JetBrains Mono, monospace"
              >
                {y}
              </text>
            ) : null,
          )}

          {/* Streams */}
          {layout.stacked.map((l) => (
            <path
              key={l.language}
              d={l.path}
              fill={`url(#stream-${l.language})`}
              stroke={languageColor(l.language)}
              strokeWidth={0.6}
              opacity={activeLang && activeLang !== l.language ? 0.15 : 1}
              style={{ transition: 'opacity 200ms', cursor: 'pointer' }}
              onMouseEnter={() => setActiveLang(l.language)}
              onMouseLeave={() => setActiveLang(null)}
            />
          ))}

          {/* Hover guide line + points */}
          {hover && (
            <g pointerEvents="none">
              <line
                x1={layout.xScale(hover.yearIdx)}
                x2={layout.xScale(hover.yearIdx)}
                y1={PAD.top}
                y2={H - PAD.bottom}
                stroke="rgba(255,255,255,0.15)"
                strokeWidth={1}
                strokeDasharray="2 2"
              />
            </g>
          )}
        </svg>

        {/* Tooltip */}
        {hover && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg border border-border-2 bg-surface-2/95 p-3 backdrop-blur-sm"
            style={{ left: Math.min(hover.x + 12, 720), top: 12, minWidth: 180 }}
          >
            <p className="text-xs font-bold text-slate-100">{years[hover.yearIdx]}</p>
            <div className="mt-1.5 space-y-0.5">
              {series
                .map((s) => ({ language: s.language, value: s.values[hover.yearIdx] ?? 0 }))
                .filter((s) => s.value > 0)
                .sort((a, b) => b.value - a.value)
                .slice(0, 6)
                .map((s) => (
                  <div key={s.language} className="flex items-center gap-2 text-[11px]">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: languageColor(s.language) }} />
                    <span className="text-slate-300 flex-1 truncate">{s.language}</span>
                    <span className="tabular text-slate-500">{formatBytes(s.value)}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px]">
        {series.slice(0, 12).map((s) => (
          <button
            key={s.language}
            onMouseEnter={() => setActiveLang(s.language)}
            onMouseLeave={() => setActiveLang(null)}
            className={`flex cursor-pointer items-center gap-1.5 transition-opacity ${
              activeLang && activeLang !== s.language ? 'opacity-40' : 'opacity-100'
            }`}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: languageColor(s.language) }} />
            <span className="text-slate-400">{s.language}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
