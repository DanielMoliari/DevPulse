'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@apollo/client/react'
import { Users, Plus, ArrowRight, Sparkles, BarChart2, AlertTriangle, FileText } from 'lucide-react'
import { MY_TEAMS_QUERY, ME_QUERY } from '@/graphql/queries'
import { CREATE_TEAM } from '@/graphql/mutations'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'
import type { Team, User } from '@/graphql/types'
import { TeamWaitlistForm } from '@/components/team-waitlist-form'

const TEAM_PREVIEW_FEATURES = [
  { Icon: BarChart2, title: 'Team Dashboard', desc: 'Commits, PRs e reviews de cada dev em um só lugar' },
  { Icon: AlertTriangle, title: 'Sinais de saúde', desc: 'Burnout detector, silos técnicos, review bottlenecks' },
  { Icon: FileText, title: 'Relatórios', desc: 'Weekly Engineering Report exportável para o board' },
]

export default function TeamPage() {
  const [showCreate, setShowCreate] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data: meData } = useQuery<{ me: User }>(ME_QUERY)
  const { data, loading, refetch } = useQuery<{ myTeams: Team[] }>(MY_TEAMS_QUERY)
  const [createTeam, { loading: creating }] = useMutation<{ createTeam: Team }>(CREATE_TEAM, {
    onCompleted: () => { void refetch(); setShowCreate(false); setTeamName('') },
    onError: (e) => setError(e.message),
  })

  const plan = meData?.me?.plan ?? 'FREE'
  const isTeamPlan = plan === 'TEAM'
  const teams = data?.myTeams ?? []

  async function handleCreate() {
    if (!teamName.trim()) return
    setError(null)
    await createTeam({ variables: { input: { name: teamName.trim() } } })
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-2">Team</p>
        <h1 className="text-3xl font-black text-slate-100">Engineering Team Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Visibilidade de time sem microgerenciamento — dados reais do GitHub, não de planilhas.
        </p>
      </div>

      {/* Coming Soon banner for non-TEAM plans */}
      {!isTeamPlan && (
        <div className="relative overflow-hidden rounded-2xl border border-accent/25 bg-gradient-to-br from-accent/8 via-surface to-surface">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-accent/5 blur-3xl" />
          <div className="relative px-8 py-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10">
              <Users className="h-7 w-7 text-accent" />
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-accent mb-4">
              <Sparkles className="h-3 w-3" /> Em breve
            </div>
            <h2 className="text-2xl font-bold text-slate-100 mb-3">Team Plan — Coming Soon</h2>
            <p className="text-slate-400 max-w-lg mx-auto text-sm leading-relaxed">
              Dashboard coletivo com leaderboard, velocity charts, burnout detector e relatórios para stakeholders.
              Construído para engineering managers que querem dados reais, não métricas de vigilância.
            </p>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto text-left">
              {TEAM_PREVIEW_FEATURES.map((f) => (
                <div key={f.title} className="rounded-xl border border-border bg-surface-2 p-4">
                  <f.Icon className="h-6 w-6 text-accent" />
                  <p className="mt-2 text-sm font-semibold text-slate-200">{f.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{f.desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-col items-center justify-center gap-3">
              <TeamWaitlistForm source="team-page" compact />
              <p className="text-xs text-slate-600">Nenhuma cobrança até o lançamento</p>
            </div>
          </div>
        </div>
      )}

      {/* Team Plan active state — shown only for TEAM plan users */}
      {isTeamPlan && (
        <>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </div>
          ) : teams.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface-2">
                <Users className="h-7 w-7 text-slate-500" />
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-200">Nenhum time ainda</p>
                <p className="mt-1 text-sm text-slate-500">Crie seu primeiro time ou peça um convite ao admin.</p>
              </div>
              <Button onClick={() => setShowCreate(true)} className="cursor-pointer">
                <Plus className="mr-2 h-4 w-4" /> Criar time
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-600">
                  {teams.length} time{teams.length !== 1 ? 's' : ''}
                </p>
                <Button size="sm" onClick={() => setShowCreate(true)} className="cursor-pointer">
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Novo time
                </Button>
              </div>
              {teams.map((team) => (
                <Link key={team.id} href={`/team/${team.id}`}>
                  <div className="flex items-center gap-4 rounded-xl border border-border bg-surface px-5 py-4 hover:border-border-2 transition-colors cursor-pointer">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2 text-sm font-bold text-slate-300">
                      {team.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-100 truncate">{team.name}</p>
                      <p className="text-xs text-slate-500">reflog.dev/team/{team.slug}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-600" />
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Create team inline form */}
          {showCreate && (
            <div className="rounded-xl border border-border bg-surface p-6 space-y-4">
              <p className="text-sm font-semibold text-slate-100">Criar novo time</p>
              <input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleCreate() }}
                placeholder="Nome do time (ex: Acme Engineering)"
                className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-accent/50 focus:outline-none"
                autoFocus
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div className="flex gap-2">
                <Button
                  onClick={() => void handleCreate()}
                  disabled={creating || !teamName.trim()}
                  className="cursor-pointer"
                  size="sm"
                >
                  {creating ? 'Criando…' : 'Criar time'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowCreate(false)} className="cursor-pointer">
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
