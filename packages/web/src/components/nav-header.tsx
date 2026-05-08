'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { AlertCircle, Bell, Check, LogOut, PanelLeftOpen, RefreshCw, Settings, User } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useQuery } from '@apollo/client/react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { ME_QUERY, REPOSITORIES_QUERY } from '@/graphql/queries'
import type { Repository, User as UserType } from '@/graphql/types'
import { clearToken } from '@/lib/auth'
import { useUIStore } from '@/store/ui-store'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/repos': 'Repositories',
  '/streaks': 'Streaks',
  '/settings': 'Settings',
}

function getPageTitle(pathname: string, repositories?: Repository[]): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  if (pathname.startsWith('/repos/')) {
    const id = pathname.split('/repos/')[1]
    const repo = repositories?.find((r) => r.id === id)
    if (repo) {
      const name = repo.fullName.split('/')[1] ?? repo.fullName
      return name
    }
    return 'Repository'
  }
  return 'reflog'
}

function formatStaleAge(ms: number): string {
  const h = Math.floor(ms / (1000 * 60 * 60))
  if (h >= 1) return `${h}h without sync`
  const m = Math.floor(ms / (1000 * 60))
  return `${m}m without sync`
}

const STALE_MS = 6 * 60 * 60 * 1000

type SyncPhase = 'idle' | 'stale' | 'syncing' | 'synced' | 'error'

const SYNC_STYLES: Record<SyncPhase, { border: string; bg: string; text: string }> = {
  idle:    { border: 'border-border-2',              bg: 'bg-transparent',        text: 'text-slate-500' },
  stale:   { border: 'border-warning/30',            bg: 'bg-warning/5',          text: 'text-warning' },
  syncing: { border: 'border-accent/30',             bg: 'bg-accent/5',           text: 'text-accent' },
  synced:  { border: 'border-emerald-500/30',        bg: 'bg-emerald-500/5',      text: 'text-emerald-400' },
  error:   { border: 'border-danger/30',             bg: 'bg-danger/5',           text: 'text-danger' },
}

interface NavHeaderProps {
  onSyncOpen: () => void
}

export function NavHeader({ onSyncOpen }: NavHeaderProps) {
  const pathname = usePathname()
  const { data, loading } = useQuery<{ me: UserType }>(ME_QUERY)
  const { data: reposData } = useQuery<{ repositories: Repository[] }>(REPOSITORIES_QUERY)
  const title = getPageTitle(pathname, reposData?.repositories)

  const [syncedFlash, setSyncedFlash] = useState(false)
  const { toggleMobileMenu } = useUIStore()

  const tracked = (reposData?.repositories ?? []).filter((r) => r.isTracked)
  const isSyncing = tracked.some((r) => r.syncState === 'SYNCING')
  const hasError = !isSyncing && tracked.some((r) => r.syncState === 'ERROR')

  // Flash "Synced" 2.5s when syncing transitions from true → false
  useEffect(() => {
    if (isSyncing) return
    setSyncedFlash(true)
    const t = setTimeout(() => setSyncedFlash(false), 2500)
    return () => clearTimeout(t)
  }, [isSyncing])

  // Derive last synced timestamp
  const lastSyncedAt = tracked.reduce<number | null>((best, r) => {
    if (!r.lastSyncedAt) return best
    const t = new Date(r.lastSyncedAt).getTime()
    return best === null || t > best ? t : best
  }, null)

  const staleMs = lastSyncedAt !== null ? Date.now() - lastSyncedAt : null
  const isStale = !isSyncing && !syncedFlash && (
    lastSyncedAt === null || (staleMs !== null && staleMs > STALE_MS)
  )

  const syncPhase: SyncPhase = isSyncing
    ? 'syncing'
    : syncedFlash
    ? 'synced'
    : hasError
    ? 'error'
    : isStale
    ? 'stale'
    : 'idle'

  const { border, bg, text } = SYNC_STYLES[syncPhase]

  const syncIcon = syncPhase === 'syncing'
    ? <RefreshCw className={`h-3.5 w-3.5 animate-spin ${text}`} />
    : syncPhase === 'synced'
    ? <Check className={`h-3.5 w-3.5 ${text}`} />
    : syncPhase === 'error'
    ? <AlertCircle className={`h-3.5 w-3.5 ${text}`} />
    : <RefreshCw className={`h-3.5 w-3.5 ${text}`} />

  const syncLabel = syncPhase === 'syncing' ? 'Syncing…'
    : syncPhase === 'synced'  ? 'Synced'
    : syncPhase === 'error'   ? 'Retry'
    : 'Sync'

  function handleLogout() {
    clearToken()
    window.location.href = '/'
  }

  const user = data?.me
  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.username?.slice(0, 2).toUpperCase() ?? '?'

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4 md:px-6">

      {/* Left — title + stale freshness indicator */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleMobileMenu}
          className="cursor-pointer rounded-md p-1.5 text-slate-500 transition-colors hover:bg-surface-2 hover:text-slate-200 md:hidden"
          aria-label="Open menu"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
        <h1 className="text-sm font-semibold text-slate-200">{title}</h1>
        {isStale && staleMs !== null && (
          <span className="hidden text-xs text-warning sm:block">
            · {formatStaleAge(staleMs)}
          </span>
        )}
        {syncPhase === 'syncing' && (
          <span className="hidden text-xs text-accent sm:block">· syncing now</span>
        )}
      </div>

      {/* Right — sync + separator + bell + avatar */}
      <div className="flex items-center gap-1">

        {/* Sync button with colored border per state */}
        <button
          onClick={onSyncOpen}
          className={[
            'flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-all',
            border, bg,
          ].join(' ')}
        >
          {syncIcon}
          <span className={text}>{syncLabel}</span>
        </button>

        {/* Separator */}
        <div className="mx-1 h-4 w-px bg-border-2" />

        {/* Bell */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-surface-2 hover:text-slate-300 focus-visible:outline-none">
              <Bell className="h-4 w-4" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className="z-50 w-72 rounded-lg border border-border-2 bg-surface-2 shadow-xl shadow-black/40 animate-in fade-in-0 zoom-in-95"
            >
              <div className="border-b border-border px-4 py-2.5">
                <span className="text-xs font-semibold text-slate-300">Notifications</span>
              </div>
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border-2 bg-surface">
                  <Bell className="h-4 w-4 text-slate-600" />
                </div>
                <p className="text-xs font-medium text-slate-500">No notifications yet</p>
                <p className="text-[11px] text-slate-700">Sync results, streak alerts and milestones will appear here</p>
              </div>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        {/* Avatar + profile dropdown */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="flex cursor-pointer items-center rounded-md p-1 transition-colors hover:bg-surface-2 focus-visible:outline-none">
              {loading ? (
                <Skeleton className="h-7 w-7 rounded-full" />
              ) : (
                <Avatar className="h-7 w-7">
                  <AvatarImage src={user?.avatarUrl ?? undefined} alt={user?.username ?? undefined} />
                  <AvatarFallback className="text-[10px] font-bold">{initials}</AvatarFallback>
                </Avatar>
              )}
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="z-50 w-52 overflow-hidden rounded-lg border border-border-2 bg-surface-2 shadow-xl shadow-black/40 animate-in fade-in-0 zoom-in-95"
              align="end"
              sideOffset={6}
            >
              {/* User identity */}
              <div className="border-b border-border px-4 py-3">
                <p className="text-sm font-semibold text-slate-100">
                  {user?.name ?? user?.username}
                </p>
                <p className="mt-0.5 text-xs text-accent">@{user?.username}</p>
              </div>

              {/* Actions */}
              <div className="p-1">
                {user?.username && (
                  <DropdownMenu.Item asChild>
                    <a
                      href={`/u/${user.username}`}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-xs text-slate-400 outline-none transition-colors hover:bg-surface-3 hover:text-slate-200"
                    >
                      <User className="h-3.5 w-3.5 shrink-0" />
                      View public profile
                    </a>
                  </DropdownMenu.Item>
                )}
                <DropdownMenu.Item asChild>
                  <a
                    href="/settings"
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-xs text-slate-400 outline-none transition-colors hover:bg-surface-3 hover:text-slate-200"
                  >
                    <Settings className="h-3.5 w-3.5 shrink-0" />
                    Settings
                  </a>
                </DropdownMenu.Item>
              </div>

              <DropdownMenu.Separator className="h-px bg-border" />

              <div className="p-1">
                <DropdownMenu.Item asChild>
                  <button
                    onClick={handleLogout}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-xs text-danger outline-none transition-colors hover:bg-danger/8"
                  >
                    <LogOut className="h-3.5 w-3.5 shrink-0" />
                    Sign out
                  </button>
                </DropdownMenu.Item>
              </div>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

      </div>
    </header>
  )
}
