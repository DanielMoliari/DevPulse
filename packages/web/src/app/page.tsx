import Link from 'next/link'
import {
  GitCommit,
  Flame,
  BarChart3,
  GitPullRequest,
  ArrowRight,
  Check,
  TrendingUp,
  Globe,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BrandLogo } from '@/components/brand-logo'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:17642'

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

const PRICING = [
  {
    plan: 'Free',
    price: '$0',
    sub: 'No credit card required',
    features: [
      '5 tracked repositories',
      '30-day history',
      'Weekly digest email',
      'Public profile & card',
    ],
    highlight: false,
  },
  {
    plan: 'Pro',
    price: '$8',
    period: '/mo',
    sub: 'Everything you need to level up',
    features: [
      'Unlimited repositories',
      'Full commit history',
      'Real-time sync',
      'Advanced analytics',
      'API access',
      'Priority support',
    ],
    highlight: true,
  },
]

const STATS = [
  { value: '50k+', label: 'Commits tracked' },
  { value: '1.2k', label: 'Active developers' },
  { value: '98%', label: 'Uptime SLA' },
  { value: '< 1s', label: 'Sync latency' },
]

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
            <p className="text-[9px] text-slate-600">days 🔥</p>
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
  return (
    <div className="min-h-screen bg-bg text-slate-100">
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
          <div className="absolute left-1/4 top-2/3 h-[300px] w-[400px] rounded-full bg-violet-500/5 blur-3xl" />
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
            {STATS.map(({ value, label }) => (
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
              {/* Mini profile card mockup */}
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
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 py-28">
        <div className="mx-auto max-w-3xl">
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-cyan-400">Pricing</p>
            <h2 className="text-4xl font-bold tracking-tight">Simple, transparent pricing</h2>
            <p className="mt-4 text-slate-500">Start free. Upgrade when you need more.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {PRICING.map(({ plan, price, period, sub, features, highlight }) => (
              <div
                key={plan}
                className={`relative rounded-2xl border p-7 ${
                  highlight
                    ? 'border-cyan-500/40 bg-gradient-to-b from-cyan-500/10 to-bg'
                    : 'border-border bg-surface'
                }`}
              >
                {highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-cyan-500 px-3 py-0.5 text-[11px] font-bold text-black tracking-wide">
                    MOST POPULAR
                  </div>
                )}
                <div className="mb-5">
                  <h3 className="text-base font-bold text-slate-300">{plan}</h3>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="tabular text-4xl font-black text-slate-100">{price}</span>
                    {period && <span className="text-slate-500">{period}</span>}
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{sub}</p>
                </div>
                <ul className="mb-6 space-y-2.5">
                  {features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-slate-400">
                      <Check className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button asChild variant={highlight ? 'default' : 'outline'} className="w-full">
                  <a href={`${API_URL}/api/v1/auth/github`}>Get started</a>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

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
