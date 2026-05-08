'use client'

import Link from 'next/link'
import { ArrowUpRight, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { formatRelative, languageColor } from '@/lib/utils'
import type { Repository } from '@/graphql/types'

interface RepoCardProps {
  repo: Repository
  maxCommits?: number
  onToggleTrack: (id: string, tracked: boolean) => void
  onSync: (id: string) => void
  syncing?: boolean
}

function formatLines(n: number): string {
  return n >= 1000 ? `+${(n / 1000).toFixed(1)}k` : `+${n}`
}

function formatLastPush(pushedAt?: string, lastSyncedAt?: string | null): string {
  const iso = pushedAt ?? lastSyncedAt
  if (!iso) return '—'
  return formatRelative(iso)
}

export function RepoCard({ repo, maxCommits = 0, onToggleTrack, onSync, syncing }: RepoCardProps) {
  const [owner, name] = repo.fullName.split('/')

  const hasMetrics = repo.isTracked && (repo.commitCount ?? 0) > 0
  const isUntracked = !repo.isTracked

  const cardOpacity = isUntracked ? 'opacity-50' : hasMetrics ? '' : 'opacity-60'

  const barWidth =
    hasMetrics && maxCommits > 0
      ? Math.max(4, Math.round(((repo.commitCount ?? 0) / maxCommits) * 100))
      : 0

  return (
    <div
      className={`group rounded-xl border border-border bg-surface p-4 transition-all hover:border-accent/40 hover:bg-surface-2 ${cardOpacity}`}
    >
      {/* Row 1: owner prefix + name + controls */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-xs text-slate-500">{owner}/</span>
          <Link
            href={`/repos/${repo.id}`}
            className="flex items-center gap-1 truncate text-sm font-semibold text-slate-100 hover:text-accent transition-colors cursor-pointer"
          >
            {name}
            <ArrowUpRight className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-accent" />
          </Link>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onSync(repo.id)}
            disabled={syncing || repo.syncState === 'SYNCING'}
            title="Sync now"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing || repo.syncState === 'SYNCING' ? 'animate-spin' : ''}`} />
          </Button>
          <Switch
            checked={repo.isTracked}
            onCheckedChange={(checked) => onToggleTrack(repo.id, checked)}
          />
        </div>
      </div>

      {/* Row 2: metrics — only when tracked */}
      {repo.isTracked && (
        <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
          <span>
            commits:{' '}
            <span className="text-slate-300">
              {repo.commitCount != null ? repo.commitCount.toLocaleString('en-US') : '—'}
            </span>
          </span>
          <span className="text-slate-700">|</span>
          <span>
            lines:{' '}
            <span className="text-slate-300">
              {repo.linesAdded != null && repo.linesAdded > 0 ? formatLines(repo.linesAdded) : '—'}
            </span>
          </span>
          <span className="text-slate-700">|</span>
          <span>
            last push:{' '}
            <span className="text-slate-300">{formatLastPush(repo.pushedAt, repo.lastSyncedAt)}</span>
          </span>
          {repo.syncState === 'SYNCING' && (
            <>
              <span className="text-slate-700">|</span>
              <span className="text-accent">syncing…</span>
            </>
          )}
          {repo.syncState === 'ERROR' && (
            <>
              <span className="text-slate-700">|</span>
              <span className="text-red-400">sync failed</span>
            </>
          )}
        </div>
      )}

      {/* Row 3: activity bar */}
      {barWidth > 0 && (
        <div className="mt-2.5 h-0.5 w-full rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${barWidth}%` }}
          />
        </div>
      )}

      {/* Row 4: language + sync time */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {repo.language && (
            <>
              <span
                className="inline-block h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: languageColor(repo.language) }}
              />
              <span className="text-xs text-slate-500">{repo.language}</span>
            </>
          )}
        </div>
        {repo.lastSyncedAt && (
          <span className="text-xs text-slate-600">synced {formatRelative(repo.lastSyncedAt)}</span>
        )}
      </div>
    </div>
  )
}

export function RepoCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-5 w-9 rounded-full" />
      </div>
      <Skeleton className="h-3 w-64" />
      <div className="h-0.5 w-full rounded-full bg-surface-2">
        <Skeleton className="h-full w-1/2 rounded-full" />
      </div>
      <Skeleton className="h-3 w-24" />
    </div>
  )
}
