import Link from 'next/link'

const LOGO_SVG = (
  <svg width="22" height="16" viewBox="0 0 28 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M4,10 L8,10 L10,4 L14,16 L17,2 L20,10 L24,10"
      stroke="#06b6d4"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

interface BrandLogoProps {
  href?: string
  size?: 'sm' | 'md'
}

export function BrandLogo({ href = '/', size = 'md' }: BrandLogoProps) {
  const iconSize = size === 'sm' ? { width: 28, height: 28 } : { width: 34, height: 34 }
  const svgEl = size === 'sm' ? (
    <svg width="18" height="13" viewBox="0 0 28 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4,10 L8,10 L10,4 L14,16 L17,2 L20,10 L24,10" stroke="#06b6d4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : LOGO_SVG

  const inner = (
    <div className="flex items-center gap-2">
      <div
        className="flex shrink-0 items-center justify-center"
        style={{
          ...iconSize,
          background: '#060a0d',
          border: '1px solid #06b6d4',
          borderRadius: 7,
        }}
      >
        {svgEl}
      </div>
      <span
        className="tracking-tight"
        style={{ fontWeight: 800, fontSize: size === 'sm' ? 13 : 14 }}
      >
        <span className="text-slate-100">ref</span>
        <span className="text-cyan-400">log</span>
      </span>
    </div>
  )

  return href ? <Link href={href}>{inner}</Link> : inner
}
