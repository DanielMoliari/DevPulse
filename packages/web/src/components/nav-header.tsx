'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { AlertCircle, Bell, Check, LogOut, PanelLeftOpen, RefreshCw, User } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'

import { useQuery } from '@apollo/client/react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SyncPanel } from '@/components/sync-panel'
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

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  // /repos/[id] — show repo name from URL segment, resolved by the page itself via <title>
  if (pathname.startsWith('/repos/')) return 'Repository'
  return 'reflog'
}

const STALE_MS = 6 * 60 * 60 * 1000

export function NavHeader() {
  const pathname = usePathname()
  const title = getPageTitle(pathname)
  const { data, loading } = useQuery<{ me: UserType }>(ME_QUERY)
  const { data: reposData } = useQuery<{ repositories: Repository[] }>(REPOSITORIES_QUERY)

  const [panelOpen, setPanelOpen] = useState(false)
  const [syncedFlash, setSyncedFlash] = useState(false)
  const { toggleMobileMenu } = useUIStore()

  const tracked = (reposData?.repositories ?? []).filter((r) => r.isTracked)
  const isSyncing = tracked.some((r) => r.syncState === 'SYNCING')
  const hasError = !isSyncing && tracked.some((r) => r.syncState === 'ERROR')

  // Flash "Synced" for 2.5s when syncing transitions to done
  useEffect(() => {
    if (!isSyncing) return
    return () => {
      setSyncedFlash(true)
      const t = setTimeout(() => setSyncedFlash(false), 2500)
      return () => clearTimeout(t)
    }
  }, [isSyncing])

  const isStale = !isSyncing && !syncedFlash && (
    tracked.length === 0 ||
    tracked.every((r) => !r.lastSyncedAt) ||
    tracked.every((r) => r.lastSyncedAt && Date.now() - new Date(r.lastSyncedAt).getTime() > STALE_MS)
  )

  type SyncState = 'syncing' | 'synced' | 'error' | 'idle' | 'stale'
  const syncState: SyncState = isSyncing
    ? 'syncing'
    : syncedFlash
    ? 'synced'
    : hasError
    ? 'error'
    : isStale
    ? 'stale'
    : 'idle'

  const syncConfig = {
    syncing: { icon: <RefreshCw className="h-3.5 w-3.5 animate-spin text-accent" />, label: 'Syncing…', labelCls: 'text-accent' },
    synced:  { icon: <Check className="h-3.5 w-3.5 text-emerald-400" />,             label: 'Synced',   labelCls: 'text-emerald-400' },
    error:   { icon: <AlertCircle className="h-3.5 w-3.5 text-danger" />,            label: 'Retry',    labelCls: 'text-danger' },
    stale:   { icon: <RefreshCw className="h-3.5 w-3.5 text-warning" />,             label: 'Sync',     labelCls: 'text-warning' },
    idle:    { icon: <RefreshCw className="h-3.5 w-3.5 text-slate-500" />,           label: 'Sync',     labelCls: 'text-slate-500' },
  } as const

  function handleLogout() {
    clearToken()
    window.location.href = '/'
  }

  const user = data?.me
  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.username?.slice(0, 2).toUpperCase() ?? '?'

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4 md:px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleMobileMenu}
            className="cursor-pointer rounded-md p-1.5 text-slate-500 transition-colors hover:bg-surface-2 hover:text-slate-200 md:hidden"
            aria-label="Open menu"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
          <h1 className="text-sm font-semibold text-slate-200">{title}</h1>
        </div>

        <div className="flex items-center gap-1">
          {/* Sync button */}
          <button
            onClick={() => setPanelOpen(true)}
            className="flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-surface-2"
          >
            {syncConfig[syncState].icon}
            <span className={syncConfig[syncState].labelCls}>
              {syncConfig[syncState].label}
            </span>
          </button>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button variant="ghost" size="icon" className="relative text-slate-500">
                <Bell className="h-4 w-4" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={6}
                className="z-50 w-72 rounded-lg border border-border-2 bg-surface-2 shadow-lg animate-in fade-in-0 zoom-in-95"
              >
                <div className="border-b border-border px-4 py-2.5">
                  <span className="text-xs font-semibold text-slate-300">Notifications</span>
                </div>
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                  <Bell className="h-6 w-6 text-slate-700" />
                  <p className="text-xs text-slate-500">No notifications yet</p>
                </div>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

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
              </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="z-50 min-w-[160px] rounded-lg border border-border-2 bg-surface-2 p-1 shadow-lg animate-in fade-in-0 zoom-in-95"
                align="end"
                sideOffset={6}
              >
                {user?.username && (
                  <DropdownMenu.Item asChild>
                    <a
                      href={`/u/${user.username}`}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-slate-300 outline-none hover:bg-surface-3 hover:text-slate-100"
                    >
                      <User className="h-3.5 w-3.5" /> View public profile
                    </a>
                  </DropdownMenu.Item>
                )}
                <DropdownMenu.Item asChild>
                  <a
                    href="/settings"
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-slate-300 outline-none hover:bg-surface-3 hover:text-slate-100"
                  >
                    <User className="h-3.5 w-3.5" /> Settings
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

      <SyncPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
    </>
  )
}
