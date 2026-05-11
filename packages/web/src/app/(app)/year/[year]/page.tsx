'use client'

import { use, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@apollo/client/react'
import { Flame, Calendar, ChevronDown, Sparkles } from 'lucide-react'
import { METRICS_QUERY, STREAK_QUERY, ME_QUERY } from '@/graphql/queries'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ActivityChart } from '@/components/activity-chart'
import { useUpgradeModalStore } from '@/store/upgrade-modal-store'
import type { DailyMetrics, StreakData, User } from '@/graphql/types'

interface PageProps {
  params: Promise<{ year: string }>
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: CURRENT_YEAR - 2014 + 1 }, (_, i) => CURRENT_YEAR - i)

function formatLarge(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}


function BigStat({
  label, value, sub, color = 'text-slate-100', border = 'border-border', from = 'from-slate-900',
  partialNote,
}: {
  label: string; value: string | number; sub?: string
  color?: string; border?: string; from?: string
  partialNote?: string
}) {
  return (
    <div className={`rounded-2xl border ${border} bg-gradient-to-br ${from} to-slate-950 p-6`}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`mt-2 text-5xl font-black tabular-nums leading-none ${color}`}>{value}</p>
      {sub && <p className="mt-2 text-xs text-slate-600">{sub}</p>}
      {partialNote && (
        <p className="mt-2 text-[10px] text-amber-500/70 font-medium">{partialNote}</p>
      )}
    </div>
  )
}

export default function YearInCodePage({ params }: PageProps) {
  const { year } = use(params)
  const router = useRouter()
  const [selectedYear, setSelectedYear] = useState(parseInt(year, 10))
  const { openModal: openUpgradeModal } = useUpgradeModalStore()

  const vars = useMemo(() => ({
    from: `${selectedYear}-01-01T00:00:00.000Z`,
    to: `${selectedYear}-12-31T23:59:59.999Z`,
  }), [selectedYear])

  const { data: metricsData, loading: metricsLoading } = useQuery<{ metrics: DailyMetrics[] }>(
    METRICS_QUERY, { variables: vars, fetchPolicy: 'cache-and-network' },
  )
  const { data: streakData } = useQuery<{ streak: StreakData }>(STREAK_QUERY)
  const { data: meData } = useQuery<{ me: User }>(ME_QUERY)

  const metrics = metricsData?.metrics ?? []
  const plan = meData?.me?.plan ?? 'FREE'
  const isFree = plan === 'FREE'
  const partialLabel = isFree ? 'últimos 90 dias' : undefined

  const stats = useMemo(() => {
    let commits = 0, additions = 0, deletions = 0, prsOpened = 0, prsMerged = 0, reviews = 0
    let activeDays = 0, bestDay = 0, bestDayDate = ''
    const byMonth = Array.from({ length: 12 }, () => ({ commits: 0 }))

    const byDay = new Map<string, { commits: number; additions: number; deletions: number; prsOpened: number; prsMerged: number; reviews: number }>()
    for (const m of metrics) {
      const d = new Date(m.date)
      const key = d.toISOString().slice(0, 10)
      const ex = byDay.get(key) ?? { commits: 0, additions: 0, deletions: 0, prsOpened: 0, prsMerged: 0, reviews: 0 }
      ex.commits += m.commits; ex.additions += m.additions; ex.deletions += m.deletions
      ex.prsOpened += m.prsOpened; ex.prsMerged += m.prsMerged; ex.reviews += m.reviewsDone
      byDay.set(key, ex)
      byMonth[d.getUTCMonth()]!.commits += m.commits
    }

    for (const [key, day] of byDay) {
      commits += day.commits; additions += day.additions; deletions += day.deletions
      prsOpened += day.prsOpened; prsMerged += day.prsMerged; reviews += day.reviews
      if (day.commits > 0) activeDays++
      if (day.commits > bestDay) { bestDay = day.commits; bestDayDate = key }
    }

    return { commits, additions, deletions, prsOpened, prsMerged, reviews, activeDays, bestDay, bestDayDate, byMonth }
  }, [metrics])

  const chartData = useMemo(() =>
    metrics
      .reduce<{ date: string; value: number }[]>((acc, m) => {
        const key = new Date(m.date).toISOString().slice(0, 10)
        const ex = acc.find((x) => x.date === key)
        if (ex) ex.value += m.commits
        else acc.push({ date: key, value: m.commits })
        return acc
      }, [])
      .sort((a, b) => a.date.localeCompare(b.date)),
  [metrics])

  const isCurrentYear = selectedYear === CURRENT_YEAR
  const longestStreak = streakData?.streak?.longestStreak ?? 0

  function handleYearChange(y: number) {
    setSelectedYear(y)
    router.replace(`/year/${y}`, { scroll: false })
  }

  const noData = !metricsLoading && stats.commits === 0

  return (
    <div className="space-y-8">
      {/* Header with year dropdown */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-2">Year in Code</p>
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-black text-slate-100">{selectedYear}</h1>
            {isCurrentYear && <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent">in progress</span>}
          </div>
          <p className="mt-1 text-sm text-slate-500">Every commit, line, and streak — distilled.</p>
        </div>

        {/* Year selector */}
        <div className="relative">
          <select
            value={selectedYear}
            onChange={(e) => handleYearChange(parseInt(e.target.value, 10))}
            className="cursor-pointer appearance-none rounded-xl border border-border bg-surface px-4 py-2.5 pr-9 text-sm font-semibold text-slate-200 transition-colors hover:border-border-2 focus:outline-none"
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>{y}{y === CURRENT_YEAR ? ' (now)' : ''}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        </div>
      </div>

      {/* No data state */}
      {noData ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface-2">
            <Calendar className="h-7 w-7 text-slate-500" />
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-200">Sem dados para {selectedYear}</p>
            <p className="mt-1.5 text-sm text-slate-500 max-w-sm">
              {selectedYear > CURRENT_YEAR
                ? 'Esse ano ainda não aconteceu.'
                : isFree
                  ? `Nenhum repositório tem atividade nos últimos 90 dias de ${selectedYear}. Faça upgrade para PRO e veja sua história completa.`
                  : `Nenhum repositório trackeado tem atividade em ${selectedYear}.`}
            </p>
            {isFree && selectedYear <= CURRENT_YEAR && (
              <button
                onClick={() => openUpgradeModal('Ver toda sua história de código')}
                className="mt-4 cursor-pointer rounded-lg bg-accent/15 px-4 py-2 text-xs font-semibold text-accent hover:bg-accent/20 transition-colors"
              >
                Upgrade para PRO →
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Loading skeleton */}
          {metricsLoading && metrics.length === 0 ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
            </div>
          ) : (
            <>
              {/* Big stats grid — always visible, partial label under each number */}
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                <BigStat label="Total commits" value={formatLarge(stats.commits)} sub="repos trackeados"
                  color="text-cyan-400" border="border-cyan-500/20" from="from-cyan-950/40"
                  partialNote={partialLabel} />
                <BigStat label="Linhas escritas" value={formatLarge(stats.additions)}
                  sub={`${formatLarge(stats.deletions)} deletadas`}
                  color="text-emerald-400" border="border-emerald-500/20" from="from-emerald-950/30"
                  partialNote={partialLabel} />
                <BigStat label="Dias ativos" value={stats.activeDays}
                  sub={`de ${isCurrentYear ? new Date().getUTCDate() + new Date().getUTCMonth() * 30 : 365} dias`}
                  color="text-slate-100"
                  partialNote={partialLabel} />
                <BigStat label="PRs abertos" value={stats.prsOpened} sub={`${stats.prsMerged} mergeados`}
                  color="text-violet-400" border="border-violet-500/20" from="from-violet-950/30"
                  partialNote={partialLabel} />
                <BigStat label="Code reviews" value={stats.reviews} sub="revisões de código"
                  color="text-amber-400" border="border-amber-500/20" from="from-amber-950/30"
                  partialNote={partialLabel} />
                <BigStat label="Melhor dia" value={stats.bestDay}
                  sub={stats.bestDayDate ? `commits em ${stats.bestDayDate}` : 'commits'}
                  color="text-orange-400" border="border-orange-500/20" from="from-orange-950/30"
                  partialNote={partialLabel} />
              </div>

              {/* Longest streak callout */}
              {longestStreak > 0 && (
                <div className="flex items-center gap-4 rounded-2xl border border-orange-500/25 bg-gradient-to-r from-orange-500/10 to-amber-500/5 px-6 py-4">
                  <Flame className="h-8 w-8 text-orange-400 shrink-0" fill="currentColor" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-orange-400/70">Melhor streak all-time</p>
                    <p className="text-3xl font-black text-orange-300">
                      {longestStreak} <span className="text-base font-normal text-orange-400/60">dias</span>
                    </p>
                  </div>
                </div>
              )}

              {/* Month-by-month breakdown — always visible */}
              <Card>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Mês a mês</p>
                  {partialLabel && (
                    <span className="text-[10px] text-amber-500/70 font-medium">{partialLabel}</span>
                  )}
                </div>
                <div className="grid grid-cols-6 gap-2 lg:grid-cols-12">
                  {stats.byMonth.map((m, i) => {
                    const maxCommits = Math.max(...stats.byMonth.map((x) => x.commits), 1)
                    const pct = (m.commits / maxCommits) * 100
                    const isPeak = m.commits === maxCommits && m.commits > 0
                    return (
                      <div key={i} className="flex flex-col items-center gap-1.5">
                        <div className="w-full h-16 flex items-end justify-center">
                          <div
                            className={`w-full rounded-t-sm ${isPeak ? 'bg-accent' : 'bg-surface-2'}`}
                            style={{ height: `${Math.max(pct, 3)}%` }}
                          />
                        </div>
                        <p className="text-[9px] text-slate-600">{MONTH_NAMES[i]}</p>
                        {m.commits > 0 && (
                          <p className="text-[9px] font-semibold tabular-nums text-slate-500">{m.commits}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </Card>

              {/* Daily commit activity chart — always visible */}
              <Card>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Atividade diária de commits</p>
                  {partialLabel && (
                    <span className="text-[10px] text-amber-500/70 font-medium">{partialLabel}</span>
                  )}
                </div>
                <ActivityChart data={chartData} type="area" height={160} loading={metricsLoading} />
              </Card>

              {/* Upgrade CTA for FREE users — history depth limitation */}
              {isFree && (
                <div className="relative overflow-hidden rounded-2xl border border-accent/25 bg-gradient-to-br from-accent/8 via-surface to-surface">
                  <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/10 blur-3xl" />
                  <div className="relative px-6 py-7 flex flex-col sm:flex-row items-center gap-5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-accent/30 bg-accent/10">
                      <Sparkles className="h-5 w-5 text-accent" />
                    </div>
                    <div className="flex-1 text-center sm:text-left">
                      <p className="text-base font-semibold text-slate-100">
                        Você está vendo os últimos 90 dias de histórico
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        Seus números reais de {selectedYear} podem ser muito maiores. PRO desbloqueia todo o histórico — cada commit que você já fez.
                      </p>
                    </div>
                    <button
                      onClick={() => openUpgradeModal('Ver toda sua história de código')}
                      className="shrink-0 cursor-pointer rounded-xl bg-accent px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent/20 hover:bg-accent/90 transition-colors whitespace-nowrap"
                    >
                      Upgrade para PRO →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
