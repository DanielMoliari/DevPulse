'use client'

import { usePathname } from 'next/navigation'
import { Bell, LogOut, User } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useQuery } from '@apollo/client/react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ME_QUERY } from '@/graphql/queries'
import type { User as UserType } from '@/graphql/types'
import { clearToken } from '@/lib/auth'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/repos': 'Repositories',
  '/metrics': 'Metrics',
  '/streaks': 'Streaks',
  '/settings': 'Settings',
}

export function NavHeader() {
  const pathname = usePathname()
  const title = PAGE_TITLES[pathname] ?? 'DevPulse'
  const { data, loading } = useQuery<{ me: UserType }>(ME_QUERY)

  function handleLogout() {
    clearToken()
    window.location.href = '/'
  }

  const user = data?.me
  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.username?.slice(0, 2).toUpperCase() ?? '?'

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
      <h1 className="text-sm font-semibold text-slate-200">{title}</h1>

      <div className="flex items-center gap-2">
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
                  <AvatarImage src={user?.avatarUrl ?? undefined} alt={user?.username} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              )}
              {loading ? (
                <Skeleton className="h-3 w-20" />
              ) : (
                <span className="text-slate-300 hidden sm:block">{user?.username}</span>
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
