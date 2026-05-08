'use client'

import Link from 'next/link'
import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery, useMutation } from '@apollo/client/react'
import { Search, Sparkles, Network, Layers, ExternalLink } from 'lucide-react'
import { RepoCard, RepoCardSkeleton } from '@/components/repo-card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ME_QUERY, REPOSITORIES_QUERY, TECH_GRAPH_QUERY } from '@/graphql/queries'
import { TRACK_REPOSITORY, UNTRACK_REPOSITORY, SYNC_REPOSITORY } from '@/graphql/mutations'
import type { Repository, User } from '@/graphql/types'
import { PLAN_LIMITS } from '@/lib/plan-limits'
import { languageColor } from '@/lib/utils'

type Tab = 'repos' | 'stack'

interface GraphNode { id: string; type: 'repo' | 'language'; name: string; value: number }
interface GraphLink { source: string; target: string; value: number }
interface TechGraphResponse { techGraph: { nodes: GraphNode[]; links: GraphLink[] } }
interface LangCluster { id: string; name: string; value: number; repos: GraphNode[]; repoCount: number }

function formatBytes(b: number): string {
  if (b < 1024) return `${b}B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`
  return `${(b / 1024 / 1024 / 1024).toFixed(1)} GB`
}

function pol(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}

export default function ReposPage() {
  const [activeTab, setActiveTab] = useState<Tab>('repos')

  const { data: meData } = useQuery<{ me: User }>(ME_QUERY)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'tracked' | 'untracked'>('all')

  const { data, loading } = useQuery<{ repositories: Repository[] }>(REPOSITORIES_QUERY)
  const [trackRepo] = useMutation(TRACK_REPOSITORY, {
    refetchQueries: [REPOSITORIES_QUERY],
  })
  const [untrackRepo] = useMutation(UNTRACK_REPOSITORY, {
    refetchQueries: [REPOSITORIES_QUERY],
  })
  const [syncRepo, { loading: syncing }] = useMutation(SYNC_REPOSITORY)
  const [currentSyncId, setCurrentSyncId] = useState<string | null>(null)

  function handleToggle(id: string, tracked: boolean) {
    if (tracked) {
      void trackRepo({ variables: { githubRepoId: id } })
    } else {
      void untrackRepo({ variables: { id } })
    }
  }

  function handleSync(id: string) {
    setCurrentSyncId(id)
    void syncRepo({ variables: { id } }).finally(() => setCurrentSyncId(null))
  }

  const repos = data?.repositories ?? []

  const sorted = [...repos].sort((a, b) => {
    const aDate = a.pushedAt ?? a.lastSyncedAt ?? ''
    const bDate = b.pushedAt ?? b.lastSyncedAt ?? ''
    return bDate.localeCompare(aDate)
  })

  const maxCommits = sorted.reduce((max, r) => Math.max(max, r.commitCount ?? 0), 0)

  const tracked = sorted.filter((r) => r.isTracked).length

  const planLimit = meData?.me?.plan ? PLAN_LIMITS[meData.me.plan]?.maxTrackedRepos ?? null : null
  const overLimit = planLimit !== null && tracked >= planLimit

  const filtered = sorted.filter((r) => {
    const matchSearch = r.fullName.toLowerCase().includes(search.toLowerCase())
    const matchFilter =
      filter === 'all' || (filter === 'tracked' ? r.isTracked : !r.isTracked)
    return matchSearch && matchFilter
  })

  // Only show skeletons on first load — not on background refetches from SyncPanel polls
  const initialLoad = loading && !data

  return (
    <div className="space-y-5">
      {/* Tab switcher */}
      <div className="flex gap-1 rounded-lg border border-border bg-surface p-1 w-fit">
        <button
          onClick={() => setActiveTab('repos')}
          className={`cursor-pointer rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${
            activeTab === 'repos' ? 'bg-surface-2 text-slate-100' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Repositories
        </button>
        <button
          onClick={() => setActiveTab('stack')}
          className={`cursor-pointer flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${
            activeTab === 'stack' ? 'bg-surface-2 text-slate-100' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Network className="h-3 w-3 shrink-0" />
          Stack
        </button>
      </div>

      {activeTab === 'repos' && (
        <>
          {/* Header row */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold text-slate-100">Repositories</h2>
              {planLimit !== null ? (
                <Badge variant={overLimit ? 'warning' : 'default'}>
                  {tracked} / {planLimit} tracked
                </Badge>
              ) : (
                <Badge variant="default">{tracked} tracked</Badge>
              )}
            </div>
            {meData?.me?.plan === 'FREE' && (
              <Button asChild variant="outline" size="sm">
                <Link href="/settings#billing">
                  <Sparkles className="h-3.5 w-3.5" />
                  Upgrade to Pro
                </Link>
              </Button>
            )}
          </div>

          {/* Plan-limit nudge */}
          {overLimit && meData?.me?.plan === 'FREE' && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-accent/20 bg-accent/5 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-dim">
                  <Sparkles className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-100">You&apos;ve hit the FREE plan cap</p>
                  <p className="text-xs text-slate-500">
                    Pro tracks up to {PLAN_LIMITS.PRO.maxTrackedRepos} repos with full history and real-time sync.
                  </p>
                </div>
              </div>
              <Button asChild size="sm">
                <Link href="/settings#billing">Upgrade →</Link>
              </Button>
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-52">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
              <Input
                className="pl-8"
                placeholder="Search repositories…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
              {(['all', 'tracked', 'untracked'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors capitalize ${
                    filter === f ? 'bg-surface-2 text-slate-100' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="space-y-2">
            {initialLoad
              ? Array.from({ length: 5 }).map((_, i) => <RepoCardSkeleton key={i} />)
              : filtered.length === 0
                ? (
                  <div className="py-16 text-center text-sm text-slate-600">
                    {search ? `No repositories matching "${search}"` : 'No repositories found'}
                  </div>
                )
                : filtered.map((repo) => (
                  <RepoCard
                    key={repo.id}
                    repo={repo}
                    maxCommits={maxCommits}
                    onToggleTrack={handleToggle}
                    onSync={handleSync}
                    syncing={syncing && currentSyncId === repo.id}
                  />
                ))}
          </div>
        </>
      )}

      {activeTab === 'stack' && <TechStackView />}
    </div>
  )
}

function TechStackView() {
  const { data, loading } = useQuery<TechGraphResponse>(TECH_GRAPH_QUERY)
  const [hoverLang, setHoverLang] = useState<string | null>(null)
  const [hoverRepo, setHoverRepo] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const layout = useMemo(() => {
    if (!data) return null
    const { nodes, links } = data.techGraph
    const langs = nodes.filter((n) => n.type === 'language')
    const repos = nodes.filter((n) => n.type === 'repo')

    const linksByRepo = new Map<string, GraphLink[]>()
    for (const l of links) {
      const arr = linksByRepo.get(l.source) ?? []
      arr.push(l); linksByRepo.set(l.source, arr)
    }
    const reposByLang = new Map<string, GraphNode[]>()
    for (const repo of repos) {
      const repoLinks = linksByRepo.get(repo.id) ?? []
      if (repoLinks.length === 0) continue
      const top = repoLinks.slice().sort((a, b) => b.value - a.value)[0]!
      const arr = reposByLang.get(top.target) ?? []
      arr.push(repo); reposByLang.set(top.target, arr)
    }

    const langStats = langs
      .map((l) => ({
        ...l,
        repos: reposByLang.get(l.id) ?? [],
        repoCount: (reposByLang.get(l.id) ?? []).length,
      }))
      .filter((l) => l.repoCount > 0)
      .sort((a, b) => b.repoCount - a.repoCount || b.value - a.value)

    const totalBytes = langs.reduce((s, l) => s + l.value, 0)
    const totalRepos = langStats.reduce((s, l) => s + l.repoCount, 0)

    return { langs: langStats, totalBytes, totalRepos }
  }, [data])

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[640px] w-full rounded-xl" />
      </div>
    )
  }

  if (!layout || layout.langs.length === 0) {
    return (
      <Card>
        <p className="text-center text-sm text-slate-500">
          No tech data yet. Track repositories on the Repositories tab first.
        </p>
      </Card>
    )
  }

  const filtered = search.trim()
    ? layout.langs.map((l) => ({
        ...l,
        repos: l.repos.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())),
      })).filter((l) => l.repos.length > 0)
    : layout.langs

  return (
    <div className="space-y-5">
      {/* Stats tiles */}
      <div className="flex flex-wrap gap-3">
        <Tile icon={Layers} label="Languages" value={String(layout.langs.length)} />
        <Tile icon={Sparkles} label="Repositories" value={String(layout.totalRepos)} />
        <Tile icon={Network} label="Total source" value={formatBytes(layout.totalBytes)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
        <Card className="!p-0 overflow-hidden">
          <ConstellationView
            langs={filtered}
            hoverLang={hoverLang}
            hoverRepo={hoverRepo}
            onHoverLang={setHoverLang}
            onHoverRepo={setHoverRepo}
          />
        </Card>

        <div className="space-y-4">
          <Card className="!p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
              <Input
                className="pl-8"
                placeholder="Search repos…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </Card>

          <Card className="!p-4">
            <p className="mb-3 text-[10px] font-medium uppercase tracking-widest text-slate-500">Top languages</p>
            <div className="space-y-2">
              {layout.langs.slice(0, 12).map((l) => {
                const pct = (l.value / layout.totalBytes) * 100
                const active = hoverLang === l.id
                return (
                  <div
                    key={l.id}
                    onMouseEnter={() => setHoverLang(l.id)}
                    onMouseLeave={() => setHoverLang(null)}
                    className={`cursor-pointer rounded-md p-2 transition-colors ${active ? 'bg-surface-2' : 'hover:bg-surface-2/50'}`}
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: languageColor(l.name) }} />
                      <span className="flex-1 font-medium text-slate-200">{l.name}</span>
                      <span className="tabular text-[11px] text-slate-500">{l.repoCount} repo{l.repoCount !== 1 ? 's' : ''}</span>
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
    </div>
  )
}

function ConstellationView({
  langs, hoverLang, hoverRepo, onHoverLang, onHoverRepo,
}: {
  langs: LangCluster[]
  hoverLang: string | null
  hoverRepo: string | null
  onHoverLang: (id: string | null) => void
  onHoverRepo: (id: string | null) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 800, h: 640 })

  useEffect(() => {
    if (!ref.current) return
    const obs = new ResizeObserver((entries) => {
      const r = entries[0]!.contentRect
      setSize({ w: r.width, h: 640 })
    })
    obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  const placed = useMemo(() => {
    const cx = size.w / 2
    const cy = size.h / 2
    const innerR = 110
    const outerR = Math.min(size.w, size.h) / 2 - 60
    const totalRepos = langs.reduce((s, l) => s + l.repoCount, 0) || 1

    let acc = 0
    const langPositions: Array<{
      lang: LangCluster
      angle: number
      sliceStart: number
      sliceEnd: number
      pos: { x: number; y: number }
      reposPlaced: Array<{ repo: GraphNode; x: number; y: number; r: number }>
    }> = []

    for (const lang of langs) {
      const sliceArc = (lang.repoCount / totalRepos) * 360
      const sliceStart = acc
      const sliceEnd = acc + sliceArc
      const center = sliceStart + sliceArc / 2
      const langPos = pol(cx, cy, innerR, center)

      const reposPlaced: Array<{ repo: GraphNode; x: number; y: number; r: number }> = []
      const sortedRepos = lang.repos.slice().sort((a, b) => b.value - a.value)
      sortedRepos.forEach((repo, i) => {
        const ringIdx = lang.repoCount <= 3 ? 0 : i % 2
        const ringR = innerR + 60 + ringIdx * 55 + (Math.sqrt(repo.value) / 600) * 8
        const inSlicePos = lang.repoCount === 1 ? 0.5 : i / Math.max(lang.repoCount - 1, 1)
        const angle = sliceStart + 6 + inSlicePos * Math.max(sliceArc - 12, 1)
        const p = pol(cx, cy, Math.min(ringR, outerR), angle)
        const repoR = Math.max(4, Math.min(14, Math.sqrt(repo.value) / 100))
        reposPlaced.push({ repo, x: p.x, y: p.y, r: repoR })
      })

      langPositions.push({ lang, angle: center, sliceStart, sliceEnd, pos: langPos, reposPlaced })
      acc = sliceEnd
    }

    return { cx, cy, innerR, outerR, langPositions }
  }, [langs, size])

  return (
    <div
      ref={ref}
      className="relative h-[640px] w-full"
      style={{ backgroundImage: 'radial-gradient(circle at center, rgba(6,182,212,0.05) 0%, transparent 65%)' }}
    >
      <svg viewBox={`0 0 ${size.w} ${size.h}`} className="absolute inset-0 h-full w-full">
        <defs>
          {placed.langPositions.map(({ lang }) => (
            <radialGradient key={`grad-${lang.id}`} id={`lang-glow-${lang.id}`}>
              <stop offset="0%" stopColor={languageColor(lang.name)} stopOpacity="0.5" />
              <stop offset="100%" stopColor={languageColor(lang.name)} stopOpacity="0" />
            </radialGradient>
          ))}
        </defs>

        {[placed.innerR, placed.innerR + 60, placed.innerR + 115].map((r) => (
          <circle key={r} cx={placed.cx} cy={placed.cy} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeDasharray="3 5" />
        ))}

        {placed.langPositions.map(({ sliceEnd }, i) => {
          if (placed.langPositions.length === 1) return null
          const p = pol(placed.cx, placed.cy, placed.outerR + 20, sliceEnd)
          return (
            <line
              key={i}
              x1={placed.cx} y1={placed.cy} x2={p.x} y2={p.y}
              stroke="rgba(255,255,255,0.025)" strokeWidth={1}
            />
          )
        })}

        {placed.langPositions.map(({ lang, pos, reposPlaced }) =>
          reposPlaced.map(({ repo, x, y }) => {
            const isActive = hoverLang === lang.id || hoverRepo === repo.id
            return (
              <line
                key={repo.id}
                x1={pos.x} y1={pos.y} x2={x} y2={y}
                stroke={isActive ? languageColor(lang.name) : 'rgba(255,255,255,0.05)'}
                strokeWidth={isActive ? 1.5 : 0.6}
                style={{ transition: 'all 200ms' }}
              />
            )
          }),
        )}

        {placed.langPositions.flatMap(({ lang, reposPlaced }) =>
          reposPlaced.map(({ repo, x, y, r }) => {
            const dim = (hoverLang && hoverLang !== lang.id) || (hoverRepo && hoverRepo !== repo.id)
            return (
              <Link key={repo.id} href={`/repos/${repo.id.replace('repo:', '')}`}>
                <circle
                  cx={x} cy={y} r={r}
                  fill="#1e293b"
                  stroke={languageColor(lang.name)}
                  strokeWidth={hoverRepo === repo.id ? 2.5 : 1.5}
                  opacity={dim ? 0.2 : 1}
                  onMouseEnter={() => onHoverRepo(repo.id)}
                  onMouseLeave={() => onHoverRepo(null)}
                  style={{ cursor: 'pointer', transition: 'all 200ms' }}
                />
              </Link>
            )
          }),
        )}

        {placed.langPositions.map(({ lang, pos }) => {
          const r = Math.max(16, Math.min(34, 14 + lang.repoCount * 2.2))
          const dim = hoverLang && hoverLang !== lang.id
          return (
            <g
              key={lang.id}
              onMouseEnter={() => onHoverLang(lang.id)}
              onMouseLeave={() => onHoverLang(null)}
              style={{ cursor: 'pointer' }}
              opacity={dim ? 0.3 : 1}
            >
              <circle cx={pos.x} cy={pos.y} r={r * 2.2} fill={`url(#lang-glow-${lang.id})`} />
              <circle
                cx={pos.x} cy={pos.y} r={r}
                fill={languageColor(lang.name)}
                stroke="#0d1117" strokeWidth={2}
              />
              <text
                x={pos.x} y={pos.y}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={Math.min(13, r / 2.2)} fontWeight={700}
                fill="#0d1117" fontFamily="Space Grotesk, sans-serif"
              >
                {lang.repoCount}
              </text>
              <text
                x={pos.x} y={pos.y + r + 14}
                textAnchor="middle"
                fontSize={11} fontWeight={600}
                fill="#f1f5f9" fontFamily="Plus Jakarta Sans, sans-serif"
              >
                {lang.name}
              </text>
            </g>
          )
        })}

        <circle cx={placed.cx} cy={placed.cy} r={50} fill="#0d1117" stroke="rgba(6,182,212,0.3)" strokeWidth={1} />
        <text x={placed.cx} y={placed.cy - 6} textAnchor="middle" fontSize="9" fill="#475569" fontFamily="JetBrains Mono, monospace">
          YOUR STACK
        </text>
        <text x={placed.cx} y={placed.cy + 12} textAnchor="middle" fontSize="20" fill="#f1f5f9" fontWeight={700} fontFamily="Space Grotesk, sans-serif">
          {placed.langPositions.length}
        </text>
        <text x={placed.cx} y={placed.cy + 26} textAnchor="middle" fontSize="9" fill="#475569">
          languages
        </text>
      </svg>

      {(hoverLang || hoverRepo) && (
        <HoverPanel
          hoverLang={hoverLang}
          hoverRepo={hoverRepo}
          placed={placed}
        />
      )}

      <div className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-3 rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-[10px] text-slate-500 backdrop-blur-sm">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" /> language hub
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full border border-slate-400 bg-slate-700" /> repository
        </span>
        <span className="text-slate-600">click a repo for details</span>
      </div>
    </div>
  )
}

function HoverPanel({ hoverLang, hoverRepo, placed }: {
  hoverLang: string | null
  hoverRepo: string | null
  placed: { langPositions: Array<{ lang: LangCluster; reposPlaced: Array<{ repo: GraphNode }> }> }
}) {
  const lang = hoverLang ? placed.langPositions.find((p) => p.lang.id === hoverLang) : null
  const repoFound = hoverRepo
    ? placed.langPositions
        .flatMap((p) => p.reposPlaced.map((r) => ({ ...r, lang: p.lang })))
        .find((r) => r.repo.id === hoverRepo)
    : null

  return (
    <div className="pointer-events-none absolute right-4 top-4 max-w-xs rounded-lg border border-border-2 bg-surface-2/95 p-3 backdrop-blur-sm">
      {lang && (
        <>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: languageColor(lang.lang.name) }} />
            <span className="text-sm font-bold text-slate-100">{lang.lang.name}</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {lang.lang.repoCount} repo{lang.lang.repoCount !== 1 ? 's' : ''} dominate this language
          </p>
          <p className="mt-0.5 text-xs text-slate-500">{formatBytes(lang.lang.value)} of source</p>
          <div className="mt-2 max-h-32 overflow-y-auto">
            {lang.lang.repos.slice(0, 6).map((r) => (
              <p key={r.id} className="truncate text-[11px] text-slate-400">
                · {r.name.split('/')[1] ?? r.name}
              </p>
            ))}
          </div>
        </>
      )}
      {repoFound && !lang && (
        <>
          <div className="flex items-center gap-2">
            <ExternalLink className="h-3 w-3 text-slate-400" />
            <span className="text-sm font-bold text-slate-100">{repoFound.repo.name.split('/')[1] ?? repoFound.repo.name}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            <span style={{ color: languageColor(repoFound.lang.name) }}>{repoFound.lang.name}</span> · {formatBytes(repoFound.repo.value)}
          </p>
          <p className="mt-1.5 text-[10px] text-slate-600">click to open detail page</p>
        </>
      )}
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
