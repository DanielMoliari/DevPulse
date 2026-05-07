'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Bell, LogOut, RefreshCw, User } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useMutation, useQuery } from '@apollo/client/react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ME_QUERY, REPOSITORIES_QUERY } from '@/graphql/queries'
import { SYNC_REPOSITORY } from '@/graphql/mutations'
import type { Repository, User as UserType } from '@/graphql/types'
import { clearToken } from '@/lib/auth'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/repos': 'Repositories',
  '/metrics': 'Metrics',
  '/streaks': 'Streaks',
  '/settings': 'Settings',
}

const STALE_MS = 6 * 60 * 60 * 1000 // 6 hours
const AUTO_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000

function useCountdown(targetMs: number | null) {
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (targetMs === null) { setRemaining(null); return }
    const tick = () => setRemaining(Math.max(0, targetMs - Date.now()))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [targetMs])

  return remaining
}

function formatCountdown(ms: number): string {
  const totalSec = Math.ceil(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`
  return `${s}s`
}

export function NavHeader() {
  const pathname = usePathname()
  const title = PAGE_TITLES[pathname] ?? 'DevPulse'
  const { data, loading } = useQuery<{ me: UserType }>(ME_QUERY)
  const { data: reposData, refetch: refetchRepos } = useQuery<{ repositories: Repository[] }>(REPOSITORIES_QUERY)
  const [syncRepository] = useMutation(SYNC_REPOSITORY)

  const [syncing, setSyncing] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)
  const syncingRef = useRef(false)

  // Derive lastSyncedAt from the most recently synced tracked repo
  useEffect(() => {
    const repos = reposData?.repositories?.filter((r) => r.isTracked) ?? []
    if (repos.length === 0) return
    const dates = repos
      .map((r) => (r.lastSyncedAt ? new Date(r.lastSyncedAt).getTime() : 0))
      .filter((t) => t > 0)
    if (dates.length > 0) setLastSyncedAt(Math.max(...dates))
  }, [reposData])

  const nextSyncAt = lastSyncedAt !== null ? lastSyncedAt + AUTO_SYNC_INTERVAL_MS : null
  const countdown = useCountdown(nextSyncAt)

  const isSyncing =
    syncing ||
    (reposData?.repositories ?? []).some((r) => r.syncState === 'SYNCING')

  async function handleSync() {
    if (syncingRef.current) return
    syncingRef.current = true
    setSyncing(true)
    try {
      const repos = reposData?.repositories?.filter((r) => r.isTracked) ?? []
      await Promise.all(repos.map((r) => syncRepository({ variables: { id: r.id } })))
      // Poll until all repos finish syncing
      let attempts = 0
      const poll = setInterval(async () => {
        attempts++
        const result = await refetchRepos()
        const stillSyncing = (result.data?.repositories ?? []).some((r) => r.syncState === 'SYNCING')
        if (!stillSyncing || attempts > 30) {
          clearInterval(poll)
          setSyncing(false)
          syncingRef.current = false
          setLastSyncedAt(Date.now())
        }
      }, 2000)
    } catch {
      setSyncing(false)
      syncingRef.current = false
    }
  }

  function handleLogout() {
    clearToken()
    window.location.href = '/'
  }

  const user = data?.me
  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.username?.slice(0, 2).toUpperCase() ?? '?'

  const isStale =
    !isSyncing &&
    (lastSyncedAt === null || Date.now() - lastSyncedAt > STALE_MS)

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
      <h1 className="text-sm font-semibold text-slate-200">{title}</h1>

      <div className="flex items-center gap-1">
        {/* Sync indicator */}
        <button
          onClick={handleSync}
          disabled={isSyncing}
          title={isSyncing ? 'Syncing…' : 'Sync all repositories'}
          className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-surface-2 disabled:cursor-not-allowed"
        >
          <RefreshCw
            className={[
              'h-3.5 w-3.5 transition-colors',
              isSyncing ? 'animate-spin text-accent' : isStale ? 'text-warning' : 'text-slate-500',
            ].join(' ')}
          />
          {isSyncing ? (
            <span className="text-accent tabular">syncing…</span>
          ) : countdown !== null && countdown > 0 ? (
            <span className="tabular text-slate-600">{formatCountdown(countdown)}</span>
          ) : null}
        </button>

        <Button variant="ghost" size="icon" className="text-slate-500">
          <Bell className="h-4 w-4" />
        </Button>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors hover:bg-surface-2 focus-visible:outline-none">
              {loading ? (
                <Skeleton className="h-7 w-7 rounded-full" />
              ) : (
                <Avatar className="h-7 w-7">
                  <AvatarImage src={user?.avatarUrl ?? undefined} alt={user?.username ?? undefined} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              )}
              {loading ? (
                <Skeleton className="h-3 w-20" />
              ) : (
                <span className="text-slate-300 hidden sm:block">{user?.name ?? user?.username ?? 'You'}</span>
              )}
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="z-50 min-w-[160px] rounded-lg border border-border-2 bg-surface-2 p-1 shadow-lg animate-in fade-in-0 zoom-in-95"
              align="end"
              sideOffset={6}
            >
              <DropdownMenu.Item asChild>
                <a
                  href="/settings"
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-slate-300 outline-none hover:bg-surface-3 hover:text-slate-100"
                >
                  <User className="h-3.5 w-3.5" /> Profile
                </a>
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <DropdownMenu.Item asChild>
                <button
                  onClick={handleLogout}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-danger outline-none hover:bg-danger/10"
                >
                  <LogOut className="h-3.5 w-3.5" /> Sign out
                </button>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  )
}
