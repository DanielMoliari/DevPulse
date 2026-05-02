'use client'

import dynamic from 'next/dynamic'
import { useMemo, useRef, useState, useEffect } from 'react'
import { useQuery } from '@apollo/client/react'
import { Network, Layers, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TECH_GRAPH_QUERY } from '@/graphql/queries'
import { languageColor } from '@/lib/utils'

// Canvas-based force graph — only loads on the client (no SSR)
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false })

interface GraphNode {
  id: string
  type: 'repo' | 'language'
  name: string
  value: number
  // injected by force layout
  x?: number; y?: number; vx?: number; vy?: number
}
interface GraphLink {
  source: string | GraphNode
  target: string | GraphNode
  value: number
}
interface TechGraphResponse {
  techGraph: { nodes: GraphNode[]; links: GraphLink[] }
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`
  return `${(b / 1024 / 1024 / 1024).toFixed(1)} GB`
}

export default function TechGraphPage() {
  const { data, loading } = useQuery<TechGraphResponse>(TECH_GRAPH_QUERY)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const [hovered, setHovered] = useState<GraphNode | null>(null)
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set())
  const [highlightLinks, setHighlightLinks] = useState<Set<GraphLink>>(new Set())

  useEffect(() => {
    if (!wrapRef.current) return
    const obs = new ResizeObserver((entries) => {
      const r = entries[0]!.contentRect
      setSize({ w: r.width, h: r.height })
    })
    obs.observe(wrapRef.current)
    return () => obs.disconnect()
  }, [])

  // Apollo freezes response objects — react-force-graph mutates them (x, y, vx, vy, __indexColor).
  // Deep-clone once when data arrives, never inside render.
  const graphData = useMemo(() => {
    if (!data) return { nodes: [], links: [] }
    return {
      nodes: data.techGraph.nodes.map((n) => ({ ...n })),
      links: data.techGraph.links.map((l) => ({ ...l })),
    }
  }, [data])

  // Stats panel (top languages, top repos by size)
  const stats = useMemo(() => {
    if (!data) return null
    const langs = data.techGraph.nodes
      .filter((n) => n.type === 'language')
      .slice()
      .sort((a, b) => b.value - a.value)
    const repos = data.techGraph.nodes
      .filter((n) => n.type === 'repo')
      .slice()
      .sort((a, b) => b.value - a.value)
    const totalBytes = langs.reduce((s, l) => s + l.value, 0)
    return { langs, repos, totalBytes }
  }, [data])

  function handleNodeHover(node: GraphNode | null) {
    if (!node) {
      setHovered(null); setHighlightNodes(new Set()); setHighlightLinks(new Set())
      return
    }
    setHovered(node)
    const nodes = new Set<string>([node.id])
    const links = new Set<GraphLink>()
    for (const l of graphData.links) {
      const srcId = typeof l.source === 'string' ? l.source : l.source.id
      const tgtId = typeof l.target === 'string' ? l.target : l.target.id
      if (srcId === node.id || tgtId === node.id) {
        nodes.add(srcId); nodes.add(tgtId)
        links.add(l)
      }
    }
    setHighlightNodes(nodes); setHighlightLinks(links)
  }

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-[640px] w-full rounded-xl" />
      </div>
    )
  }

  if (data.techGraph.nodes.length === 0) {
    return (
      <Card>
        <p className="text-center text-sm text-slate-500">
          No tech data yet. Track some repositories on the Repositories page first.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-accent" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-accent">Tech Universe</span>
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold text-slate-100">Your stack, mapped</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            Every tracked repo connected to every language it uses. Hover to inspect, drag to rearrange,
            scroll to zoom.
          </p>
        </div>
        <div className="flex gap-3 text-xs">
          <Tile icon={Layers} label="Languages" value={String(stats!.langs.length)} />
          <Tile icon={Sparkles} label="Repositories" value={String(stats!.repos.length)} />
          <Tile icon={Network} label="Total source" value={formatBytes(stats!.totalBytes)} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
        {/* Graph canvas */}
        <Card className="relative !p-0 overflow-hidden">
          <div
            ref={wrapRef}
            className="relative h-[640px] w-full"
            style={{ backgroundImage: 'radial-gradient(circle at center, rgba(6,182,212,0.04) 0%, transparent 60%)' }}
          >
            <ForceGraph2D
              graphData={graphData}
              width={size.w}
              height={size.h}
              backgroundColor="rgba(0,0,0,0)"
              nodeRelSize={4}
              cooldownTicks={120}
              warmupTicks={40}
              d3AlphaDecay={0.02}
              d3VelocityDecay={0.35}
              linkColor={(l: GraphLink) =>
                highlightLinks.has(l) ? 'rgba(6,182,212,0.55)' : 'rgba(255,255,255,0.05)'
              }
              linkWidth={(l: GraphLink) => (highlightLinks.has(l) ? 1.8 : 0.6)}
              linkDirectionalParticles={(l: GraphLink) => (highlightLinks.has(l) ? 2 : 0)}
              linkDirectionalParticleSpeed={0.006}
              linkDirectionalParticleColor={() => '#06b6d4'}
              onNodeHover={(node) => handleNodeHover((node as GraphNode) ?? null)}
              nodeCanvasObject={(node, ctx, globalScale) => {
                const n = node as GraphNode
                if (typeof n.x !== 'number' || typeof n.y !== 'number' || !isFinite(n.x) || !isFinite(n.y)) return
                const isLang = n.type === 'language'
                const total = n.value
                // Radius: languages scale by sqrt of bytes, repos by sqrt(repo size)
                const r = isLang ? Math.max(8, Math.sqrt(total) / 30) : Math.max(3, Math.sqrt(total) / 80)
                const dim = highlightNodes.size > 0 && !highlightNodes.has(n.id)

                ctx.globalAlpha = dim ? 0.15 : 1

                // Glow for language nodes
                if (isLang) {
                  const grad = ctx.createRadialGradient(n.x, n.y, r * 0.3, n.x, n.y, r * 2.5)
                  grad.addColorStop(0, languageColor(n.name) + '55')
                  grad.addColorStop(1, 'transparent')
                  ctx.fillStyle = grad
                  ctx.beginPath()
                  ctx.arc(n.x, n.y, r * 2.5, 0, 2 * Math.PI)
                  ctx.fill()
                }

                // Main circle
                ctx.beginPath()
                ctx.arc(n.x, n.y, r, 0, 2 * Math.PI)
                ctx.fillStyle = isLang ? languageColor(n.name) : '#1e293b'
                ctx.fill()
                ctx.lineWidth = 1.5 / globalScale
                ctx.strokeStyle = isLang ? '#0d1117' : 'rgba(255,255,255,0.4)'
                ctx.stroke()

                // Label for language nodes (always) and hovered repo
                const showLabel = isLang || highlightNodes.has(n.id)
                if (showLabel) {
                  const fontSize = isLang ? Math.max(10, 12 / globalScale) : 11 / globalScale
                  ctx.font = `${isLang ? '600' : '500'} ${fontSize}px "Plus Jakarta Sans", sans-serif`
                  ctx.fillStyle = isLang ? '#f1f5f9' : '#94a3b8'
                  ctx.textAlign = 'center'
                  ctx.textBaseline = 'middle'
                  const label = isLang ? n.name : n.name.split('/')[1] ?? n.name
                  ctx.fillText(label, n.x, n.y + r + fontSize)
                }

                ctx.globalAlpha = 1
              }}
              nodePointerAreaPaint={(node, color, ctx) => {
                const n = node as GraphNode
                if (typeof n.x !== 'number' || typeof n.y !== 'number' || !isFinite(n.x) || !isFinite(n.y)) return
                const r = n.type === 'language' ? Math.max(8, Math.sqrt(n.value) / 30) : 6
                ctx.fillStyle = color
                ctx.beginPath()
                ctx.arc(n.x, n.y, r + 2, 0, 2 * Math.PI)
                ctx.fill()
              }}
            />

            {/* Tooltip */}
            {hovered && (
              <div className="pointer-events-none absolute left-4 top-4 rounded-lg border border-border-2 bg-surface-2/95 p-3 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  {hovered.type === 'language' && (
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: languageColor(hovered.name) }} />
                  )}
                  <span className="text-xs font-semibold text-slate-100">{hovered.name}</span>
                  <span className="text-[10px] uppercase tracking-widest text-slate-500">
                    {hovered.type}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {hovered.type === 'language' ? `${formatBytes(hovered.value)} across ${highlightNodes.size - 1} repos` : formatBytes(hovered.value)}
                </p>
              </div>
            )}

            {/* Legend */}
            <div className="pointer-events-none absolute bottom-4 right-4 flex items-center gap-3 rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-[10px] text-slate-500 backdrop-blur-sm">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-accent" /> language
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full border border-slate-400 bg-slate-700" /> repository
              </span>
            </div>
          </div>
        </Card>

        {/* Side rail: top languages */}
        <Card className="!p-4">
          <p className="mb-3 text-[10px] font-medium uppercase tracking-widest text-slate-500">Top languages</p>
          <div className="space-y-2.5">
            {stats!.langs.slice(0, 12).map((l) => {
              const pct = (l.value / stats!.totalBytes) * 100
              return (
                <div key={l.id}
                  className="cursor-pointer rounded-md p-2 transition-colors hover:bg-surface-2"
                  onMouseEnter={() => handleNodeHover(l)}
                  onMouseLeave={() => handleNodeHover(null)}
                >
                  <div className="flex items-center gap-2 text-xs">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: languageColor(l.name) }} />
                    <span className="flex-1 font-medium text-slate-200">{l.name}</span>
                    <span className="tabular text-[11px] text-slate-500">{pct.toFixed(1)}%</span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: languageColor(l.name) }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    </div>
  )
}

function Tile({ icon: Icon, label, value }: {
  icon: typeof Network; label: string; value: string
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-slate-500">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <p className="tabular mt-0.5 text-base font-bold text-slate-100">{value}</p>
    </div>
  )
}
