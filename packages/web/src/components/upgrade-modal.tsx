'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useMutation } from '@apollo/client/react'
import { Check, Sparkles, X } from 'lucide-react'
import { CREATE_CHECKOUT_SESSION } from '@/graphql/mutations'
import { Button } from '@/components/ui/button'

const PLANS = [
  {
    id: 'FREE',
    name: 'Free',
    monthly: 0,
    yearly: 0,
    description: 'See what you\'ve built',
    features: [
      'All your repositories, tracked',
      '90-day commit history',
      'Streak tracking',
      'Public shareable profile',
      'Weekly digest email',
    ],
    cta: 'Current plan',
    highlight: false,
  },
  {
    id: 'PRO',
    name: 'Pro',
    monthly: 7,
    yearly: 67,
    description: 'Your complete coding story',
    features: [
      'Everything in Free',
      'Full history — every commit ever',
      'Year in Code (Wrapped-style recap)',
      'Rank pills on public profile',
      'Unlimited streak freezes',
      'Priority support',
    ],
    cta: 'Upgrade to Pro',
    highlight: true,
  },
  {
    id: 'TEAM',
    name: 'Team',
    monthly: 0,
    yearly: 0,
    description: 'Coming soon',
    features: [
      'Everything in Pro',
      'Team dashboard & leaderboard',
      'Per-developer analytics',
      'Engineering velocity reports',
      'SSO & admin controls',
    ],
    cta: 'Join waitlist',
    highlight: false,
  },
] as const

type Interval = 'monthly' | 'yearly'

interface UpgradeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentPlan?: 'FREE' | 'PRO' | 'TEAM'
  headline?: string
}

export function UpgradeModal({ open, onOpenChange, currentPlan = 'FREE', headline }: UpgradeModalProps) {
  const [interval, setInterval] = useState<Interval>('monthly')
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [createCheckout] = useMutation<{ createCheckoutSession: { url: string } }>(CREATE_CHECKOUT_SESSION)

  async function handleUpgrade(plan: 'PRO' | 'TEAM') {
    setLoadingPlan(plan)
    setError(null)
    try {
      const { data } = await createCheckout({ variables: { plan, interval } })
      if (data?.createCheckoutSession?.url) {
        window.location.href = data.createCheckoutSession.url
      } else {
        setError('Could not start checkout. Try again in a moment.')
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not start checkout'
      setError(msg.replace(/^.*?Forbidden:?\s*/, ''))
    } finally {
      setLoadingPlan(null)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm animate-in fade-in-0" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-4xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-border-2 bg-bg shadow-2xl shadow-black/40 max-h-[92vh] overflow-y-auto animate-in fade-in-0 zoom-in-95"
          aria-describedby={undefined}
        >
          <div className="px-6 py-6 sm:px-8 sm:py-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="text-xl font-bold text-slate-100 sm:text-2xl">
                  {headline ?? 'Choose your plan'}
                </Dialog.Title>
                <p className="mt-1 text-sm text-slate-400">
                  Upgrade anytime. Cancel anytime. No surprises.
                </p>
              </div>
              <Dialog.Close asChild>
                <button
                  className="cursor-pointer rounded-md p-1.5 text-slate-500 transition-colors hover:bg-surface-2 hover:text-slate-200"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>

            <div className="mt-6 flex justify-center">
              <div className="inline-flex rounded-lg bg-surface-2 p-1">
                <button
                  onClick={() => setInterval('monthly')}
                  className={`cursor-pointer rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors ${
                    interval === 'monthly' ? 'bg-bg text-slate-100 shadow-sm' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setInterval('yearly')}
                  className={`cursor-pointer rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors ${
                    interval === 'yearly' ? 'bg-bg text-slate-100 shadow-sm' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Annual <span className="ml-1 text-accent">−20%</span>
                </button>
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                {error}
              </div>
            )}

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {PLANS.map((plan) => {
                const isTeam = plan.id === 'TEAM'
                const price = interval === 'monthly' ? plan.monthly : plan.yearly
                const isCurrent = plan.id === currentPlan
                const monthlyEquivalent = interval === 'yearly' && plan.yearly > 0
                  ? (plan.yearly / 12).toFixed(2)
                  : null
                return (
                  <div
                    key={plan.id}
                    className={`flex flex-col rounded-xl border p-5 ${
                      plan.highlight
                        ? 'border-accent/40 bg-gradient-to-b from-accent/5 to-transparent shadow-lg shadow-accent/10'
                        : 'border-border-2 bg-surface'
                    } ${isTeam ? 'opacity-70' : ''}`}
                  >
                    {plan.highlight && (
                      <div className="mb-3 inline-flex w-fit items-center gap-1 rounded-full bg-accent/15 px-2.5 py-0.5 text-[10px] font-semibold text-accent">
                        <Sparkles className="h-3 w-3" /> MOST POPULAR
                      </div>
                    )}
                    {isTeam && (
                      <div className="mb-3 inline-flex w-fit items-center gap-1 rounded-full bg-surface-2 border border-border px-2.5 py-0.5 text-[10px] font-semibold text-slate-500">
                        COMING SOON
                      </div>
                    )}
                    <p className="text-sm font-semibold text-slate-100">{plan.name}</p>
                    <p className="text-xs text-slate-500">{plan.description}</p>
                    <div className="mt-4 flex items-baseline gap-1">
                      {isTeam ? (
                        <span className="text-2xl font-bold text-slate-600">—</span>
                      ) : (
                        <>
                          <span className="text-3xl font-bold text-slate-100">${price}</span>
                          <span className="text-xs text-slate-500">
                            /{interval === 'monthly' ? 'mo' : 'yr'}
                          </span>
                        </>
                      )}
                    </div>
                    {!isTeam && monthlyEquivalent && (
                      <p className="mt-0.5 text-[11px] text-slate-600">~${monthlyEquivalent}/mo billed yearly</p>
                    )}
                    <ul className="mt-5 flex-1 space-y-2">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-xs text-slate-300">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-5">
                      {isCurrent ? (
                        <button
                          disabled
                          className="w-full cursor-not-allowed rounded-md bg-surface-2 py-2 text-xs font-medium text-slate-500"
                        >
                          {plan.cta}
                        </button>
                      ) : isTeam ? (
                        <button
                          disabled
                          className="w-full cursor-not-allowed rounded-md bg-surface-2 py-2 text-xs font-medium text-slate-600"
                        >
                          {plan.cta}
                        </button>
                      ) : plan.id === 'FREE' ? null : (
                        <Button
                          variant={plan.highlight ? 'default' : 'outline'}
                          onClick={() => handleUpgrade(plan.id as 'PRO' | 'TEAM')}
                          disabled={loadingPlan !== null}
                          className="w-full cursor-pointer"
                          size="sm"
                        >
                          {loadingPlan === plan.id ? 'Starting checkout…' : plan.cta}
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <p className="mt-6 text-center text-[11px] text-slate-600">
              All plans include unlimited public profile views · Cancel anytime · Secure payment via Stripe
            </p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
