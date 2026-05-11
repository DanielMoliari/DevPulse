'use client'

import { useState } from 'react'
import { Check, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TeamWaitlistForm } from '@/components/team-waitlist-form'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:17642'

interface PlanRow {
  id: 'FREE' | 'PRO' | 'TEAM'
  name: string
  description: string
  monthly: number
  yearly: number
  features: string[]
  highlight: boolean
  cta: string
}

// Source of truth — keep aligned with `packages/web/src/components/upgrade-modal.tsx`
const PLANS: PlanRow[] = [
  {
    id: 'FREE',
    name: 'Free',
    description: 'See what you\'ve built',
    monthly: 0,
    yearly: 0,
    features: [
      'All your repositories, tracked',
      '90-day commit history',
      'Streak tracking',
      'Public shareable profile',
      'Weekly digest email',
    ],
    highlight: false,
    cta: 'Get started free',
  },
  {
    id: 'PRO',
    name: 'Pro',
    description: 'Your complete coding story',
    monthly: 7,
    yearly: 67,
    features: [
      'Everything in Free',
      'Full history — every commit ever',
      'Year in Code (Wrapped-style recap)',
      'Rank pills on public profile',
      'Unlimited streak freezes',
      'Priority support',
    ],
    highlight: true,
    cta: 'Start with Pro',
  },
  {
    id: 'TEAM',
    name: 'Team',
    description: 'Para times de engenharia',
    monthly: 0,
    yearly: 0,
    features: [
      'Everything in Pro',
      'Team dashboard & leaderboard',
      'Burnout detector & health signals',
      'Per-developer analytics',
      'Weekly Engineering Report',
      'SSO & admin controls',
    ],
    highlight: false,
    cta: 'Join waitlist',
  },
]

const COMPARE_ROWS = [
  { label: 'Repositories tracked',        free: 'All',        pro: 'All',         team: 'All'       },
  { label: 'Commit history',              free: '90 days',    pro: 'All time',    team: 'All time'  },
  { label: 'Auto-sync interval',          free: '6h',         pro: '1h',          team: '1h'        },
  { label: 'Year in Code recap',          free: false,        pro: true,          team: true        },
  { label: 'Public profile & card',       free: true,         pro: true,          team: true        },
  { label: 'Rank pills on profile',       free: false,        pro: true,          team: true        },
  { label: 'Streak freezes',              free: '1 lifetime', pro: 'Unlimited',   team: 'Unlimited' },
  { label: 'Weekly digest email',         free: true,         pro: true,          team: true        },
  { label: 'Team dashboard',              free: false,        pro: false,         team: true        },
  { label: 'Burnout detector',            free: false,        pro: false,         team: true        },
  { label: 'Engineering velocity report', free: false,        pro: false,         team: true        },
  { label: 'SSO & admin controls',        free: false,        pro: false,         team: true        },
  { label: 'Priority support',            free: false,        pro: true,          team: true        },
]

export function PricingSection() {
  const [annual, setAnnual] = useState(false)

  return (
    <section id="pricing" className="px-6 py-28">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-cyan-400">Pricing</p>
          <h2 className="text-4xl font-bold tracking-tight">Simple, transparent pricing</h2>
          <p className="mt-4 text-slate-500">Start free — all your repos, no credit card. Upgrade when you want the full picture.</p>

          {/* Billing toggle */}
          <div className="mt-8 inline-flex items-center gap-1 rounded-full border border-border bg-surface p-1">
            <button
              onClick={() => setAnnual(false)}
              className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                !annual ? 'bg-surface-2 text-slate-100' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`flex cursor-pointer items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                annual ? 'bg-surface-2 text-slate-100' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Annual
              <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-bold text-cyan-400">
                SAVE 20%
              </span>
            </button>
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 items-stretch">
          {PLANS.map((plan) => {
            const isTeam = plan.id === 'TEAM'
            const price = annual ? plan.yearly : plan.monthly
            const monthlyEquivalent = annual && plan.yearly > 0 ? (plan.yearly / 12).toFixed(2) : null
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border p-7 ${
                  plan.highlight
                    ? 'border-cyan-500/40 bg-gradient-to-b from-cyan-500/10 to-bg'
                    : 'border-border bg-surface'
                } ${isTeam ? 'opacity-80' : ''}`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-cyan-500 px-3 py-0.5 text-[11px] font-bold text-black tracking-wide">
                    <Sparkles className="h-3 w-3" /> MOST POPULAR
                  </div>
                )}
                {isTeam && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-surface-2 border border-border px-3 py-0.5 text-[11px] font-bold text-slate-400 tracking-wide">
                    COMING SOON
                  </div>
                )}
                <div className="mb-5">
                  <h3 className={`text-base font-bold ${plan.highlight ? 'text-slate-100' : 'text-slate-300'}`}>
                    {plan.name}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">{plan.description}</p>
                  <div className="mt-3 flex items-baseline gap-1">
                    {isTeam ? (
                      <span className="text-2xl font-bold text-slate-400">—</span>
                    ) : (
                      <>
                        <span className="tabular text-4xl font-black text-slate-100">${price}</span>
                        <span className="text-slate-500">/{annual ? 'yr' : 'mo'}</span>
                      </>
                    )}
                  </div>
                  {!isTeam && (monthlyEquivalent ? (
                    <p className="mt-1 text-xs text-cyan-500">~${monthlyEquivalent}/mo billed yearly</p>
                  ) : plan.id === 'FREE' ? (
                    <p className="mt-1 text-xs text-slate-600">No credit card required</p>
                  ) : (
                    <p className="mt-1 text-xs text-slate-600">
                      ~${(plan.yearly / 12).toFixed(2)}/mo billed annually
                    </p>
                  ))}
                </div>
                <ul className="mb-6 space-y-2.5 flex-1">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className={`flex items-center gap-2.5 text-sm ${
                        plan.highlight ? 'text-slate-300' : 'text-slate-400'
                      }`}
                    >
                      <Check
                        className={`h-3.5 w-3.5 shrink-0 ${plan.highlight ? 'text-cyan-400' : 'text-slate-600'}`}
                      />
                      {f}
                    </li>
                  ))}
                </ul>
                {isTeam ? (
                  <div className="mt-auto">
                    <TeamWaitlistForm source="pricing" compact />
                  </div>
                ) : (
                  <Button
                    asChild
                    variant={plan.highlight ? 'default' : 'outline'}
                    className="mt-auto w-full cursor-pointer"
                  >
                    <a href={`${API_URL}/api/v1/auth/github`}>
                      {plan.cta}
                    </a>
                  </Button>
                )}
              </div>
            )
          })}
        </div>

        {/* Comparison table */}
        <div className="mt-10 overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">Feature</th>
                <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-widest text-slate-500">Free</th>
                <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-widest text-cyan-400">Pro</th>
                <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-widest text-slate-300">Team</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map(({ label, free, pro, team }, i) => (
                <tr
                  key={label}
                  className={`border-b border-border last:border-0 ${i % 2 === 0 ? 'bg-surface' : 'bg-surface-2/50'}`}
                >
                  <td className="px-5 py-3 text-slate-400">{label}</td>
                  <td className="px-5 py-3 text-center">
                    {typeof free === 'boolean' ? (
                      free ? <Check className="mx-auto h-4 w-4 text-slate-500" /> : <span className="text-slate-700">—</span>
                    ) : (
                      <span className="text-slate-500">{free}</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-center">
                    {typeof pro === 'boolean' ? (
                      pro ? <Check className="mx-auto h-4 w-4 text-cyan-400" /> : <span className="text-slate-700">—</span>
                    ) : (
                      <span className="font-medium text-cyan-400">{pro}</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-center">
                    {typeof team === 'boolean' ? (
                      team ? <Check className="mx-auto h-4 w-4 text-slate-300" /> : <span className="text-slate-700">—</span>
                    ) : (
                      <span className="font-medium text-slate-300">{team}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-8 text-center text-[11px] text-slate-600">
          All plans include unlimited public profile views · Cancel anytime · Secure payment via Stripe
        </p>
      </div>
    </section>
  )
}
