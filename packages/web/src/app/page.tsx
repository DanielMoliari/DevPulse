'use client'

import Link from 'next/link'
import { gql } from '@apollo/client'
import { useQuery } from '@apollo/client/react'
import { AuthRedirect } from '@/components/auth-redirect'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  GitCommit,
  Flame,
  BarChart3,
  BarChart2,
  GitPullRequest,
  ArrowRight,
  TrendingUp,
  Globe,
  Zap,
  Search,
  AlertTriangle,
  FileText,
  ShieldCheck,
  MessageSquare,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BrandLogo } from '@/components/brand-logo'
import { PricingSection } from '@/components/pricing-section'
import { TeamWaitlistForm } from '@/components/team-waitlist-form'
import { PLATFORM_STATS_QUERY } from '@/graphql/queries'
import { languageColor } from '@/lib/utils'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:17642'

const PUBLIC_PROFILE_LANDING_QUERY = gql`
  query PublicProfileLanding($username: String!) {
    publicProfile(username: $username) {
      username
      displayName
      avatarUrl
      totalCommits
      currentStreak
      topLanguages { name percent }
      trackedRepos { fullName }
    }
  }
`

interface LandingProfileLanguage {
  name: string
  percent: number
}

interface LandingProfile {
  username: string
  displayName: string
  avatarUrl: string | null
  totalCommits: number
  currentStreak: number | null
  topLanguages: LandingProfileLanguage[]
  trackedRepos: { fullName: string }[] | null
}

function formatCommits(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function MiniProfileCard() {
  const { data } = useQuery<{ publicProfile: LandingProfile | null }>(
    PUBLIC_PROFILE_LANDING_QUERY,
    { variables: { username: 'danielmoliari' }, errorPolicy: 'ignore' },
  )

  const profile = data?.publicProfile

  if (!profile) {
    // Static fallback while loading or if unavailable
    return (
      <div className="w-full max-w-xs rounded-xl border border-white/8 bg-[#111] p-5 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600" />
          <div>
            <p className="text-sm font-semibold text-slate-100">Daniel Moliari</p>
            <p className="text-xs text-slate-500">@danielmoliari</p>
          </div>
        </div>
        <div className="mb-3 grid grid-cols-3 gap-2">
          {[
            { v: '3.9k', l: 'Commits' },
            { v: '14', l: 'Streak' },
            { v: '62', l: 'Repos' },
          ].map(({ v, l }) => (
            <div key={l} className="rounded-lg bg-white/4 p-2 text-center">
              <p className="text-sm font-bold text-cyan-400">{v}</p>
              <p className="text-[9px] text-slate-600">{l}</p>
            </div>
          ))}
        </div>
        <div className="flex h-1.5 overflow-hidden rounded-full">
          {[
            { w: '45%', c: '#06b6d4' },
            { w: '25%', c: '#a78bfa' },
            { w: '20%', c: '#34d399' },
            { w: '10%', c: '#f59e0b' },
          ].map((s, i) => (
            <div key={i} style={{ width: s.w, backgroundColor: s.c }} />
          ))}
        </div>
        <p className="mt-1.5 text-[9px] text-slate-600">TypeScript · Python · Go · Rust</p>
      </div>
    )
  }

  const langs = profile.topLanguages.slice(0, 4)
  const repoCount = profile.trackedRepos?.length ?? 0

  return (
    <div className="w-full max-w-xs rounded-xl border border-white/8 bg-[#111] p-5 shadow-2xl">
      <div className="mb-4 flex items-center gap-3">
        {profile.avatarUrl ? (
          <img
            src={profile.avatarUrl}
            alt={profile.displayName}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600" />
        )}
        <div>
          <p className="text-sm font-semibold text-slate-100">{profile.displayName}</p>
          <p className="text-xs text-slate-500">@{profile.username}</p>
        </div>
      </div>
      <div className="mb-3 grid grid-cols-3 gap-2">
        {[
          { v: formatCommits(profile.totalCommits), l: 'Commits' },
          { v: String(profile.currentStreak ?? 0), l: 'Streak' },
          { v: String(repoCount), l: 'Repos' },
        ].map(({ v, l }) => (
          <div key={l} className="rounded-lg bg-white/4 p-2 text-center">
            <p className="text-sm font-bold text-cyan-400">{v}</p>
            <p className="text-[9px] text-slate-600">{l}</p>
          </div>
        ))}
      </div>
      {langs.length > 0 && (
        <>
          <div className="flex h-1.5 overflow-hidden rounded-full">
            {langs.map((lang) => (
              <div
                key={lang.name}
                style={{ width: `${lang.percent}%`, backgroundColor: languageColor(lang.name) }}
              />
            ))}
          </div>
          <p className="mt-1.5 text-[9px] text-slate-600">
            {langs.map((l) => l.name).join(' · ')}
          </p>
        </>
      )}
    </div>
  )
}

const FEATURES = [
  {
    icon: GitCommit,
    title: 'Contribution Heatmap',
    desc: 'Your entire GitHub history on one canvas. Spot your most productive weeks, track consistency, and see exactly when you code best.',
  },
  {
    icon: Flame,
    title: 'Streak Engine',
    desc: "Day streaks with fire. Never break the chain — reflog tracks every day you ship and alerts you before a streak dies.",
  },
  {
    icon: BarChart3,
    title: 'Deep Commit Analytics',
    desc: 'Commits over time, churn rate, language shifts, PR throughput. More signal, less noise — in one clean view.',
  },
  {
    icon: GitPullRequest,
    title: 'PR Intelligence',
    desc: 'Merge rates, review cycles, time-to-close. Track how your PR game evolves week over week.',
  },
  {
    icon: TrendingUp,
    title: 'Growth Trends',
    desc: 'Are you shipping more than last month? Reviewing more? reflog answers those questions automatically.',
  },
  {
    icon: Globe,
    title: 'Public Profile',
    desc: 'A shareable developer card with your real metrics. Put it in your bio, your README, or your portfolio.',
  },
]


const TEAM_FEATURES = [
  { Icon: BarChart2,     title: 'Team Dashboard',       desc: 'Leaderboard de commits, PRs e reviews por dev. Velocity chart do time ao longo do tempo. Heatmap coletivo de contribuição.' },
  { Icon: AlertTriangle, title: 'Sinais de saúde',       desc: 'Burnout detector por dev. Concentration risk (um dev com >70% dos commits de um repo). Review bottlenecks e silos técnicos.' },
  { Icon: FileText,      title: 'Relatórios executivos', desc: 'Weekly Engineering Report em PDF para o board. Sprint retrospective com dados reais. Onboarding progress para novos devs.' },
  { Icon: ShieldCheck,   title: 'SSO & Admin controls',  desc: 'Integração com GitHub Org para import automático de membros. Roles: Admin, Manager, Member. Granularidade de privacidade por dev.' },
  { Icon: MessageSquare, title: 'Integração Slack',      desc: 'Resumo semanal do time no canal de engenharia. Alertas de burnout em DM para o manager. Configurável por threshold.' },
  { Icon: TrendingUp,    title: 'Acompanhar evolução',   desc: 'Curva de contribuição de novos devs (30/60/90 dias). Tech debt signal por repo. Comparativo de velocity entre sprints.' },
]

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M+`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k+`
  return String(n)
}

function RepoSearchBar() {
  const router = useRouter()
  const [query, setQuery] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    const parts = trimmed.replace(/^https?:\/\/github\.com\//, '').split('/')
    if (parts.length >= 2) {
      router.push(`/r/${parts[0]}/${parts[1]}`)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex w-full max-w-md mx-auto items-center gap-2">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="owner/repo — analyze any public repo"
          className="w-full rounded-lg border border-border bg-surface py-2.5 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30"
        />
      </div>
      <Button type="submit" variant="outline" size="sm" className="shrink-0 cursor-pointer">
        Analyze
      </Button>
    </form>
  )
}

function HeroPreview() {
  const heatCols = Array.from({ length: 52 })
  const heatRows = Array.from({ length: 7 })

  return (
    <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#111] shadow-2xl shadow-black/70 ring-1 ring-white/5">
      {/* Chrome bar */}
      <div className="flex items-center gap-1.5 border-b border-white/6 bg-[#0d0d0d] px-4 py-3">
        <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]/70" />
        <div className="h-2.5 w-2.5 rounded-full bg-[#febc2e]/70" />
        <div className="h-2.5 w-2.5 rounded-full bg-[#28c840]/70" />
        <div className="mx-auto flex h-6 w-56 items-center justify-center rounded border border-white/8 bg-[#0a0a0a] text-[10px] text-slate-600">
          reflog.app/dashboard
        </div>
      </div>

      <div className="p-5">
        {/* KPI row */}
        <div className="mb-4 grid grid-cols-4 gap-2.5">
          {[
            { label: 'COMMITS THIS WEEK', value: '47', color: '#06b6d4' },
            { label: 'PRS MERGED', value: '12', color: '#a78bfa' },
            { label: 'REVIEWS DONE', value: '28', color: '#34d399' },
            { label: 'STREAK', value: '14', color: '#f59e0b' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-lg border border-white/6 bg-[#161616] px-3 py-2.5">
              <p className="mb-1 text-[8px] font-semibold uppercase tracking-widest" style={{ color: `${color}80` }}>{label}</p>
              <p className="tabular text-lg font-bold text-slate-100">{value}</p>
            </div>
          ))}
        </div>

        {/* Heatmap */}
        <div className="mb-3 rounded-lg border border-white/6 bg-[#161616] p-4">
          <p className="mb-3 text-[8px] font-semibold uppercase tracking-widest text-slate-600">CONTRIBUTION ACTIVITY</p>
          <div className="flex gap-[3px]">
            {heatCols.map((_, i) => (
              <div key={i} className="flex flex-col gap-[3px]">
                {heatRows.map((_, j) => {
                  const seed = ((i * 7 + j) * 9301 + 49297) % 233280
                  const rand = seed / 233280
                  const bg =
                    rand < 0.38 ? '#1a1d20'
                    : rand < 0.58 ? '#083344'
                    : rand < 0.78 ? '#0891b2'
                    : '#06b6d4'
                  return (
                    <div key={j} style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: bg }} />
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom row: streak + langs */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="col-span-1 rounded-lg border border-white/6 bg-[#161616] p-3">
            <p className="mb-2 text-[8px] font-semibold uppercase tracking-widest text-slate-600">CURRENT STREAK</p>
            <p className="text-2xl font-black text-amber-400">14</p>
            <p className="text-[9px] text-slate-600">days</p>
          </div>
          <div className="col-span-2 rounded-lg border border-white/6 bg-[#161616] p-3">
            <p className="mb-2 text-[8px] font-semibold uppercase tracking-widest text-slate-600">LANGUAGES</p>
            <div className="mb-2 flex h-2 overflow-hidden rounded-full">
              {[
                { w: '42%', c: '#06b6d4' },
                { w: '28%', c: '#a78bfa' },
                { w: '18%', c: '#34d399' },
                { w: '12%', c: '#f59e0b' },
              ].map((s, i) => (
                <div key={i} style={{ width: s.w, backgroundColor: s.c }} />
              ))}
            </div>
            <div className="flex gap-3">
              {['TypeScript', 'Python', 'Go', 'Rust'].map((l, i) => (
                <span key={l} className="text-[8px] text-slate-500">{l}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const { data: statsData } = useQuery<{ platformStats: { userCount: number; commitCount: number } }>(
    PLATFORM_STATS_QUERY,
  )
  const stats = statsData?.platformStats

  return (
    <div className="min-h-screen bg-bg text-slate-100">
      <AuthRedirect />
      {/* Nav */}
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-border bg-bg/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <BrandLogo />
          <div className="flex items-center gap-4">
            <Link href="#features" className="hidden text-sm text-slate-500 hover:text-slate-200 transition-colors sm:block">
              Features
            </Link>
            <Link href="#pricing" className="hidden text-sm text-slate-500 hover:text-slate-200 transition-colors sm:block">
              Pricing
            </Link>
            <Button asChild size="sm">
              <a href={`${API_URL}/api/v1/auth/github`}>Connect GitHub</a>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-28 pb-24 text-center">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/3 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/6 blur-3xl" />
          <div className="absolute left-1/4 top-2/3 h-[300px] w-[400px] rounded-full bg-accent/5 blur-3xl" />
        </div>

        <div className="relative z-10 max-w-3xl">
          {/* Badge */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/8 px-4 py-1.5 text-xs font-semibold text-cyan-400 tracking-wide">
            <Zap className="h-3 w-3" fill="currentColor" />
            Strava for developers
          </div>

          <h1 className="mb-6 text-5xl font-black leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">
            Your GitHub activity,
            <br />
            <span className="bg-gradient-to-r from-cyan-400 to-cyan-300 bg-clip-text text-transparent">
              beautifully analyzed
            </span>
          </h1>

          <p className="mx-auto mb-10 max-w-xl text-lg leading-relaxed text-slate-400">
            Track commits, streaks, and PRs in real time. See what you&apos;ve built,
            spot your patterns, and stay motivated — all in one clean dashboard.
          </p>

          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button asChild size="lg" className="gap-2 px-7">
              <a href={`${API_URL}/api/v1/auth/github`}>
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
                Connect with GitHub
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
            <Button asChild variant="outline" size="lg" className="gap-2">
              <Link href="#features">See features</Link>
            </Button>
          </div>

          <p className="mt-4 text-xs text-slate-600">Free forever · No credit card needed · Connects in 30 seconds</p>

          <RepoSearchBar />
        </div>

        {/* Dashboard preview */}
        <div className="relative z-10 mt-16 w-full max-w-5xl">
          <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-cyan-500/15 to-transparent pointer-events-none" />
          <HeroPreview />
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-y border-border bg-surface px-6 py-12">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {[
              { value: stats ? formatCount(stats.commitCount) : '…', label: 'Commits tracked' },
              { value: stats ? formatCount(stats.userCount) : '…', label: 'Developers joined' },
              { value: '6', label: 'Metrics per repo' },
              { value: 'Free', label: 'To get started' },
            ].map(({ value, label }) => (
              <div key={label} className="text-center">
                <p className="text-3xl font-black text-cyan-400">{value}</p>
                <p className="mt-1 text-sm text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-6 py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-cyan-400">Features</p>
            <h2 className="text-4xl font-bold tracking-tight">Built for developers who care about growth</h2>
            <p className="mx-auto mt-4 max-w-lg text-slate-500">
              Not just a stats page. reflog turns your GitHub history into actionable, motivating insights.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="group rounded-xl border border-border bg-surface p-6 transition-all hover:border-cyan-500/30 hover:bg-surface-2"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10 transition-colors group-hover:bg-cyan-500/15">
                  <Icon className="h-5 w-5 text-cyan-400" />
                </div>
                <h3 className="mb-2 font-semibold text-slate-100">{title}</h3>
                <p className="text-sm leading-relaxed text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Public profile highlight */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/8 via-bg to-bg">
          <div className="grid grid-cols-1 gap-0 lg:grid-cols-2">
            <div className="flex flex-col justify-center p-10 lg:p-14">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-cyan-400">Public Profile</p>
              <h2 className="mb-4 text-3xl font-bold tracking-tight">
                Your developer card,
                <br />
                shareable anywhere
              </h2>
              <p className="mb-8 text-slate-400 leading-relaxed">
                Every reflog user gets a public profile at{' '}
                <span className="font-mono text-cyan-400 text-sm">reflog.app/u/you</span>. Share it in your
                GitHub bio, LinkedIn, or README — it updates live with your real commit stats.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button asChild size="sm">
                  <a href={`${API_URL}/api/v1/auth/github`}>Create your profile</a>
                </Button>
                <Button asChild variant="ghost" size="sm" className="gap-1 text-slate-500">
                  <Link href="/u/danielmoliari">
                    See an example <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-center border-t border-cyan-500/10 bg-black/20 p-8 lg:border-l lg:border-t-0">
              <MiniProfileCard />
            </div>
          </div>
        </div>
      </section>

      {/* Team section — for engineering managers / CTOs */}
      <section id="team" className="px-6 py-24 border-t border-border">
        <div className="mx-auto max-w-5xl">
          <div className="mb-4 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-accent">Team Plan — Em breve</p>
            <h2 className="text-4xl font-bold tracking-tight">Para engineering managers</h2>
            <p className="mt-4 text-slate-500 max-w-2xl mx-auto">
              Dados reais do GitHub — commits, PRs, reviews — agregados no nível do time.
              Visibilidade sem microgerenciamento.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TEAM_FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border border-border bg-surface p-6 transition-all hover:border-accent/30 hover:bg-surface-2">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 transition-colors group-hover:bg-accent/15">
                  <f.Icon className="h-5 w-5 text-accent" />
                </div>
                <h3 className="mb-2 font-semibold text-slate-100">{f.title}</h3>
                <p className="text-sm leading-relaxed text-slate-500">{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-slate-400">
              Preço a partir de <span className="font-semibold text-slate-200">$49/mês</span> para times de até 5 devs.
              Não cobramos por seat.
            </p>
            <TeamWaitlistForm source="landing" compact />
            <p className="text-xs text-slate-600">Lançamento previsto para Q3 2026 · Sem cobrança até o lançamento</p>
          </div>
        </div>
      </section>

      <PricingSection />

      {/* Final CTA */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 h-64 w-96 rounded-full bg-cyan-500/8 blur-3xl" />
          <h2 className="relative text-4xl font-black tracking-tight sm:text-5xl">
            Start shipping with
            <br />
            <span className="bg-gradient-to-r from-cyan-400 to-cyan-300 bg-clip-text text-transparent">
              more clarity
            </span>
          </h2>
          <p className="relative mx-auto mt-5 max-w-md text-slate-400">
            Join developers who track their progress with reflog. Connect GitHub, see your
            dashboard in under a minute.
          </p>
          <div className="relative mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button asChild size="lg" className="gap-2 px-8">
              <a href={`${API_URL}/api/v1/auth/github`}>
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
                Connect with GitHub — it&apos;s free
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <BrandLogo size="sm" href="/" />
          <div className="flex items-center gap-6 text-xs text-slate-600">
            <Link href="#features" className="hover:text-slate-400 transition-colors">Features</Link>
            <Link href="#pricing" className="hover:text-slate-400 transition-colors">Pricing</Link>
            <Link href="/u/danielmoliari" className="hover:text-slate-400 transition-colors">Example profile</Link>
          </div>
          <p className="text-xs text-slate-700">© {new Date().getFullYear()} reflog</p>
        </div>
      </footer>
    </div>
  )
}
