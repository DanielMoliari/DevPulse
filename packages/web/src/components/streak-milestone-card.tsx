'use client'

import { useState } from 'react'
import { Flame, Share2, X, Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'

const MILESTONES = [7, 30, 60, 100, 200, 365]

function getMilestone(streak: number): number | null {
  return [...MILESTONES].reverse().find((m) => streak >= m) ?? null
}

function getMilestoneLabel(days: number): string {
  if (days >= 365) return 'One full year 🔥'
  if (days >= 200) return '200-day legend'
  if (days >= 100) return 'Triple digits'
  if (days >= 60) return 'Two months straight'
  if (days >= 30) return 'One month strong'
  return 'One week done'
}

interface StreakMilestoneCardProps {
  streak: number
  username: string | null | undefined
  onDismiss: () => void
}

export function StreakMilestoneCard({ streak, username, onDismiss }: StreakMilestoneCardProps) {
  const milestone = getMilestone(streak)
  const [copied, setCopied] = useState<'link' | 'post' | null>(null)

  if (!milestone) return null

  const label = getMilestoneLabel(milestone)
  const profileUrl = username ? `${window.location.origin}/u/${username}` : null

  const postText = `🔥 ${milestone}-day coding streak on reflog!\n\n${label} — ${milestone} consecutive days of shipping.\n\nTrack your own dev momentum 👇\n${profileUrl ?? 'reflog.app'}`

  function copyLink() {
    if (!profileUrl) return
    void navigator.clipboard.writeText(profileUrl).then(() => {
      setCopied('link')
      setTimeout(() => setCopied(null), 2000)
    })
  }

  function copyPost() {
    void navigator.clipboard.writeText(postText).then(() => {
      setCopied('post')
      setTimeout(() => setCopied(null), 2000)
    })
  }

  function shareLinkedIn() {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(profileUrl ?? 'https://reflog.app')}`
    window.open(url, '_blank', 'noopener,noreferrer,width=600,height=600')
  }

  function shareTwitter() {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(postText)}`
    window.open(url, '_blank', 'noopener,noreferrer,width=600,height=500')
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-surface p-6">
      {/* Glow orbs */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-orange-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-amber-500/10 blur-2xl" />

      {/* Dismiss */}
      <button
        onClick={onDismiss}
        className="absolute right-3 top-3 cursor-pointer rounded-md p-1 text-slate-600 transition-colors hover:text-slate-400"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        {/* Icon + count */}
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-orange-500/30 bg-orange-500/10">
            <Flame className="h-8 w-8 text-orange-400" fill="currentColor" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-orange-400/80">Milestone unlocked</p>
            <p className="text-3xl font-black tabular-nums text-slate-100">{milestone} days</p>
            <p className="text-sm text-slate-400">{label}</p>
          </div>
        </div>

        {/* Share actions */}
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 border-orange-500/30 text-orange-300 hover:border-orange-500/50 hover:bg-orange-500/10"
            onClick={shareLinkedIn}
          >
            <Share2 className="h-3.5 w-3.5" />
            LinkedIn
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 border-orange-500/30 text-orange-300 hover:border-orange-500/50 hover:bg-orange-500/10"
            onClick={shareTwitter}
          >
            <Share2 className="h-3.5 w-3.5" />
            X / Twitter
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 border-border-2 text-slate-400 hover:text-slate-200"
            onClick={copyPost}
          >
            {copied === 'post' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            {copied === 'post' ? 'Copied!' : 'Copy post'}
          </Button>
          {profileUrl && (
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-slate-500 hover:text-slate-300"
              onClick={copyLink}
            >
              {copied === 'link' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === 'link' ? 'Copied!' : 'Copy link'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
