'use client'

import { useEffect, useState } from 'react'

interface LoadingScreenProps {
  message?: string
  subMessage?: string
}

const PULSES = [0, 1, 2, 3, 4, 5, 6]

export function LoadingScreen({
  message = 'Loading…',
  subMessage,
}: LoadingScreenProps) {
  const [activeBar, setActiveBar] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setActiveBar((prev) => (prev + 1) % PULSES.length)
    }, 120)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-8 bg-bg">
      {/* Animated logo mark */}
      <div
        className="flex shrink-0 items-center justify-center"
        style={{
          width: 56,
          height: 56,
          background: '#060a0d',
          border: '1px solid #06b6d4',
          borderRadius: 12,
        }}
      >
        <svg width="36" height="26" viewBox="0 0 28 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M4,10 L8,10 L10,4 L14,16 L17,2 L20,10 L24,10"
            stroke="#06b6d4"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: 60,
              strokeDashoffset: 0,
              animation: 'draw 1.8s ease-in-out infinite',
            }}
          />
        </svg>
      </div>

      {/* Bar equalizer */}
      <div className="flex items-end gap-1" style={{ height: 28 }}>
        {PULSES.map((_, i) => {
          const dist = Math.abs(i - activeBar)
          const height = dist === 0 ? 28 : dist === 1 ? 20 : dist === 2 ? 12 : 6
          return (
            <div
              key={i}
              style={{
                width: 4,
                height,
                borderRadius: 2,
                backgroundColor: dist === 0 ? '#06b6d4' : dist === 1 ? '#0891b2' : '#083344',
                transition: 'height 0.12s ease, background-color 0.12s ease',
              }}
            />
          )
        })}
      </div>

      {/* Text */}
      <div className="text-center">
        <p className="text-sm font-medium text-slate-300">{message}</p>
        {subMessage && <p className="mt-1 text-xs text-slate-600">{subMessage}</p>}
      </div>

      <style>{`
        @keyframes draw {
          0%   { stroke-dashoffset: 60; opacity: 0.4; }
          50%  { stroke-dashoffset: 0;  opacity: 1;   }
          100% { stroke-dashoffset: -60; opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
