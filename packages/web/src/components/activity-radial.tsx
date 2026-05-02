'use client'

import { useMemo, useState } from 'react'

interface RadialDataPoint { date: string; commits: number }
interface ActivityRadialProps { data: RadialDataPoint[]; size?: number }

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Polar to cartesian
function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}

// SVG arc path between two angles at the given radius
function arcPath(cx: number, cy: number, rIn: number, rOut: number, a1: number, a2: number): string {
  const p1 = polar(cx, cy, rOut, a1)
  const p2 = polar(cx, cy, rOut, a2)
  const p3 = polar(cx, cy, rIn, a2)
  const p4 = polar(cx, cy, rIn, a1)
  const large = a2 - a1 > 180 ? 1 : 0
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${rOut} ${rOut} 0 ${large} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${rIn} ${rIn} 0 ${large} 0 ${p4.x} ${p4.y}`,
    'Z',
  ].join(' ')
}

export function ActivityRadial({ data, size = 320 }: ActivityRadialProps) {
  const [hover, setHover] = useState<{ dow: number; commits: number } | null>(null)

  const dist = useMemo(() => {
    // 7-bucket day-of-week histogram from raw daily metrics
    const counts = new Array(7).fill(0) as number[]
    for (const d of data) {
      if (!d.commits) continue
      counts[new Date(d.date).getUTCDay()]! += d.commits
    }
    const max = Math.max(...counts, 1)
    return { counts, max, total: counts.reduce((s, n) => s + n, 0) }
  }, [data])

  const cx = size / 2
  const cy = size / 2
  const rOut = size / 2 - 6
  const rIn = size / 2 - 80
  const segAngle = 360 / 7
  const peakDow = dist.counts.indexOf(dist.max)

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full">
        <defs>
          <radialGradient id="ar-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="ar-segment" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.55" />
          </linearGradient>
        </defs>

        {/* Background glow */}
        <circle cx={cx} cy={cy} r={rOut + 4} fill="url(#ar-glow)" />

        {/* Reference rings */}
        {[0.33, 0.66, 1].map((p) => (
          <circle key={p} cx={cx} cy={cy} r={rIn + (rOut - rIn) * p} fill="none" stroke="rgba(255,255,255,0.04)" strokeDasharray="2 3" />
        ))}

        {/* Segments */}
        {dist.counts.map((count, i) => {
          const a1 = i * segAngle + 1
          const a2 = (i + 1) * segAngle - 1
          const ratio = count / dist.max
          const r = rIn + (rOut - rIn) * Math.max(ratio, 0.04)
          const isPeak = i === peakDow && count > 0
          return (
            <g key={i}>
              {/* Faint full-radius backdrop */}
              <path d={arcPath(cx, cy, rIn, rOut, a1, a2)} fill="rgba(255,255,255,0.02)" />
              {/* Active fill */}
              {count > 0 && (
                <path
                  d={arcPath(cx, cy, rIn, r, a1, a2)}
                  fill="url(#ar-segment)"
                  stroke={isPeak ? '#22d3ee' : 'transparent'}
                  strokeWidth={1.5}
                  onMouseEnter={() => setHover({ dow: i, commits: count })}
                  onMouseLeave={() => setHover(null)}
                  style={{ cursor: 'pointer', transition: 'all 200ms' }}
                />
              )}
              {/* Day label */}
              <text
                x={polar(cx, cy, rOut + 18, a1 + segAngle / 2).x}
                y={polar(cx, cy, rOut + 18, a1 + segAngle / 2).y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="10"
                fill={isPeak ? '#22d3ee' : '#475569'}
                fontWeight={isPeak ? 600 : 400}
                fontFamily="JetBrains Mono, monospace"
              >
                {DOW[i]}
              </text>
            </g>
          )
        })}

        {/* Center info */}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="10" fill="#64748b" fontFamily="JetBrains Mono, monospace">
          BUSIEST
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="22" fill="#f1f5f9" fontWeight={700} fontFamily="Space Grotesk, sans-serif">
          {dist.total > 0 ? DOW[peakDow] : '—'}
        </text>
        {dist.total > 0 && (
          <text x={cx} y={cy + 32} textAnchor="middle" fontSize="10" fill="#64748b">
            {dist.counts[peakDow]!.toLocaleString()} commits
          </text>
        )}
      </svg>

      {hover && (
        <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-md border border-border-2 bg-surface-2/95 px-2.5 py-1 backdrop-blur-sm">
          <p className="text-[11px] text-slate-100">
            <span className="font-semibold">{DOW[hover.dow]}</span>
            <span className="ml-2 text-slate-500">{hover.commits.toLocaleString()} commits</span>
          </p>
        </div>
      )}
    </div>
  )
}
