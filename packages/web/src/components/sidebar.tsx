'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useQuery } from '@apollo/client/react'
import {
  LayoutDashboard,
  GitBranch,
  Flame,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  Sparkles,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/ui-store'
import { Button } from '@/components/ui/button'
import { ME_QUERY } from '@/graphql/queries'
import type { User } from '@/graphql/types'

const NAV_MAIN = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/repos', label: 'Repositories', icon: GitBranch },
  { href: '/streaks', label: 'Streaks', icon: Flame },
  { href: `/year/${new Date().getFullYear()}`, label: 'Year in Code', icon: Sparkles },
]

const NAV_BOTTOM = [
  { href: '/settings', label: 'Settings', icon: Settings },
]

function NavLinks({ onLinkClick }: { onLinkClick?: () => void }) {
  const pathname = usePathname()
  const { sidebarOpen } = useUIStore()
  const { data: meData } = useQuery<{ me: User }>(ME_QUERY)
  const isTeamPlan = meData?.me?.plan === 'TEAM'

  return (
    <>
      {NAV_MAIN.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            onClick={onLinkClick}
            title={!sidebarOpen ? label : undefined}
            className={cn(
              'flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors',
              active
                ? 'bg-accent-dim text-accent'
                : 'text-slate-500 hover:bg-surface-2 hover:text-slate-200',
              !sidebarOpen && 'justify-center px-0',
            )}
          >
            <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-accent' : '')} />
            {sidebarOpen && <span>{label}</span>}
          </Link>
        )
      })}

      {/* Team item */}
      {(() => {
        const href = '/team'
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            href={href}
            onClick={onLinkClick}
            title={!sidebarOpen ? 'Team' : undefined}
            className={cn(
              'flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors',
              active
                ? 'bg-accent-dim text-accent'
                : 'text-slate-500 hover:bg-surface-2 hover:text-slate-200',
              !sidebarOpen && 'justify-center px-0',
            )}
          >
            <Users className={cn('h-4 w-4 shrink-0', active ? 'text-accent' : '')} />
            {sidebarOpen && (
              <span className="flex flex-1 items-center gap-1.5 min-w-0">
                <span className="truncate">Team</span>
                {!isTeamPlan && (
                  <span className="shrink-0 rounded-sm bg-accent/10 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-accent">
                    Soon
                  </span>
                )}
              </span>
            )}
          </Link>
        )
      })()}

      {NAV_BOTTOM.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            onClick={onLinkClick}
            title={!sidebarOpen ? label : undefined}
            className={cn(
              'flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors',
              active
                ? 'bg-accent-dim text-accent'
                : 'text-slate-500 hover:bg-surface-2 hover:text-slate-200',
              !sidebarOpen && 'justify-center px-0',
            )}
          >
            <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-accent' : '')} />
            {sidebarOpen && <span>{label}</span>}
          </Link>
        )
      })}
    </>
  )
}

export function MobileDrawer() {
  const { mobileMenuOpen, setMobileMenuOpen } = useUIStore()

  if (!mobileMenuOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 md:hidden"
        onClick={() => setMobileMenuOpen(false)}
      />
      {/* Drawer */}
      <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-surface md:hidden">
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
            <div
              className="flex shrink-0 items-center justify-center"
              style={{ width: 36, height: 36, background: '#060a0d', border: '1px solid #06b6d4', borderRadius: 7 }}
            >
              <svg width="28" height="20" viewBox="0 0 28 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4,10 L8,10 L10,4 L14,16 L17,2 L20,10 L24,10" stroke="#06b6d4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-sm font-extrabold tracking-tight" style={{ fontWeight: 800 }}>
              <span className="text-slate-100">ref</span><span className="text-cyan-400">log</span>
            </span>
          </Link>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="cursor-pointer rounded-md p-1 text-slate-500 hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 p-2 pt-3">
          <NavLinks onLinkClick={() => setMobileMenuOpen(false)} />
        </nav>
      </aside>
    </>
  )
}

export function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useUIStore()

  return (
    <aside
      className={cn(
        'hidden h-full flex-col border-r border-border bg-surface transition-all duration-200 md:flex',
        sidebarOpen ? 'w-52' : 'w-14',
      )}
    >
      {/* Logo */}
      <Link
        href="/dashboard"
        className={cn('flex h-14 items-center border-b border-border px-3 transition-opacity hover:opacity-80', sidebarOpen ? 'gap-2.5' : 'justify-center')}
      >
        <div
          className="flex shrink-0 items-center justify-center"
          style={{ width: 36, height: 36, background: '#060a0d', border: '1px solid #06b6d4', borderRadius: 7 }}
        >
          <svg width="28" height="20" viewBox="0 0 28 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4,10 L8,10 L10,4 L14,16 L17,2 L20,10 L24,10" stroke="#06b6d4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        {sidebarOpen && (
          <span className="text-sm tracking-tight" style={{ fontWeight: 800 }}>
            <span className="text-slate-100">ref</span><span className="text-cyan-400">log</span>
          </span>
        )}
      </Link>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 p-2 pt-3">
        <NavLinks />
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-border p-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="w-full"
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarOpen ? (
            <PanelLeftClose className="h-4 w-4" />
          ) : (
            <PanelLeftOpen className="h-4 w-4" />
          )}
        </Button>
      </div>
    </aside>
  )
}
