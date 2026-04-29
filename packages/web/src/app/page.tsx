import Link from 'next/link'
import { Zap, GitCommit, Flame, BarChart3, GitPullRequest, ArrowRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

const FEATURES = [
  {
    icon: GitCommit,
    title: 'Contribution Heatmap',
    desc: 'Visualize your entire commit history on a GitHub-style calendar. Spot patterns, maintain streaks, and celebrate consistency.',
  },
  {
    icon: Flame,
    title: 'Streak Tracker',
    desc: 'Never break the chain. Track your daily coding streak with fire — and get notified before it dies.',
  },
  {
    icon: BarChart3,
    title: 'Deep Metrics',
    desc: 'Commits over time, language breakdown, PR throughput, review load. Everything in one clean dashboard.',
  },
  {
    icon: GitPullRequest,
    title: 'PR Analytics',
    desc: 'Track merge rates, review cycles, and how your PR game has evolved. Benchmark against your own history.',
  },
]

const PRICING = [
  {
    plan: 'Free',
    price: '$0',
    features: ['5 tracked repositories', '30-day history', 'Weekly digest email', 'Public profile'],
    highlight: false,
  },
  {
    plan: 'Pro',
    price: '$8',
    period: '/mo',
    features: ['Unlimited repositories', 'Full history', 'Real-time sync', 'Advanced analytics', 'API access'],
    highlight: true,
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg text-slate-100">
      {/* Nav */}
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-border bg-bg/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent">
              <Zap className="h-4 w-4 text-black" fill="currentColor" />
            </div>
            <span className="font-semibold tracking-tight">DevPulse</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="#pricing" className="text-sm text-slate-500 hover:text-slate-200 transition-colors">
              Pricing
            </Link>
            <Button asChild size="sm">
              <a href={`${API_URL}/api/v1/auth/github`}>Connect GitHub</a>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-14 text-center">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[600px] w-[600px] rounded-full bg-accent/5 blur-3xl" />
        </div>

        <div className="relative z-10 max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-dim px-3 py-1 text-xs font-medium text-accent">
            <Flame className="h-3 w-3" fill="currentColor" />
            Strava for developers
          </div>

          <h1 className="mb-6 text-5xl font-black leading-[1.1] tracking-tight sm:text-6xl">
            Your GitHub activity,
            <br />
            <span className="text-accent">beautifully analyzed</span>
          </h1>

          <p className="mx-auto mb-10 max-w-xl text-lg leading-relaxed text-slate-400">
            Track commits, streaks, and PRs in real time. See what you&apos;ve built, spot your patterns,
            and stay motivated — all in one clean dashboard.
          </p>

          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button asChild size="lg">
              <a href={`${API_URL}/api/v1/auth/github`}>
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
                Connect with GitHub
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="#features">See features</Link>
            </Button>
          </div>
        </div>

        {/* Dashboard preview */}
        <div className="relative z-10 mt-20 w-full max-w-5xl">
          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl shadow-black/60">
            <div className="flex items-center gap-1.5 border-b border-border bg-surface-2 px-4 py-3">
              <div className="h-2.5 w-2.5 rounded-full bg-danger/60" />
              <div className="h-2.5 w-2.5 rounded-full bg-warning/60" />
              <div className="h-2.5 w-2.5 rounded-full bg-success/60" />
              <div className="mx-auto flex h-6 w-64 items-center justify-center rounded border border-border bg-bg text-[10px] text-slate-600">
                devpulse.app/dashboard
              </div>
            </div>
            <div className="p-6">
              <div className="mb-4 grid grid-cols-4 gap-3">
                {[
                  { label: 'COMMITS THIS WEEK', value: '47' },
                  { label: 'PRS MERGED', value: '12' },
                  { label: 'REVIEWS DONE', value: '28' },
                  { label: 'STREAK', value: '14🔥' },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg border border-border bg-surface-2 p-3">
                    <p className="mb-1 text-[9px] font-medium uppercase tracking-widest text-slate-600">{label}</p>
                    <p className="tabular text-xl font-bold text-slate-100">{value}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-lg border border-border bg-surface-2 p-4">
                <p className="mb-3 text-[9px] font-medium uppercase tracking-widest text-slate-600">CONTRIBUTION ACTIVITY</p>
                <div className="flex gap-0.5">
                  {Array.from({ length: 40 }).map((_, i) => (
                    <div key={i} className="flex flex-col gap-0.5">
                      {Array.from({ length: 7 }).map((_, j) => {
                        const seed = ((i * 7 + j) * 9301 + 49297) % 233280
                        const rand = seed / 233280
                        const bg = rand < 0.4 ? '#1e2124' : rand < 0.6 ? '#083344' : rand < 0.8 ? '#0891b2' : '#06b6d4'
                        return <div key={j} style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: bg }} />
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <p className="mb-2 text-xs font-medium uppercase tracking-widest text-accent">Features</p>
            <h2 className="text-3xl font-bold tracking-tight">Everything you need to level up</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-xl border border-border bg-surface p-6 transition-colors hover:border-border-2">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent-dim">
                  <Icon className="h-5 w-5 text-accent" />
                </div>
                <h3 className="mb-2 font-semibold text-slate-100">{title}</h3>
                <p className="text-sm leading-relaxed text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 py-24">
        <div className="mx-auto max-w-3xl">
          <div className="mb-14 text-center">
            <p className="mb-2 text-xs font-medium uppercase tracking-widest text-accent">Pricing</p>
            <h2 className="text-3xl font-bold tracking-tight">Simple, transparent pricing</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {PRICING.map(({ plan, price, period, features, highlight }) => (
              <div
                key={plan}
                className={`rounded-xl border p-6 ${highlight ? 'border-accent/40 bg-accent-dim' : 'border-border bg-surface'}`}
              >
                {highlight && (
                  <div className="mb-4 inline-block rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-black">
                    Most popular
                  </div>
                )}
                <h3 className="text-lg font-bold text-slate-100">{plan}</h3>
                <div className="my-2 flex items-baseline gap-0.5">
                  <span className="tabular text-3xl font-black text-slate-100">{price}</span>
                  {period && <span className="text-slate-500">{period}</span>}
                </div>
                <ul className="mt-4 space-y-2">
                  {features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-400">
                      <Check className="h-3.5 w-3.5 shrink-0 text-accent" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button asChild variant={highlight ? 'default' : 'outline'} className="mt-6 w-full">
                  <a href={`${API_URL}/api/v1/auth/github`}>Get started</a>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-8 text-center text-sm text-slate-600">
        <div className="flex items-center justify-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-accent">
            <Zap className="h-3 w-3 text-black" fill="currentColor" />
          </div>
          <span>DevPulse © {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  )
}
