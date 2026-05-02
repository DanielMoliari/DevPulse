'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  GitBranch,
  BarChart3,
  Flame,
  Network,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/ui-store'
import { Button } from '@/components/ui/button'

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/repos', label: 'Repositories', icon: GitBranch },
  { href: '/tech', label: 'Tech graph', icon: Network },
  { href: '/metrics', label: 'Metrics', icon: BarChart3 },
  { href: '/streaks', label: 'Streaks', icon: Flame },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarOpen, toggleSidebar } = useUIStore()

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-border bg-surface transition-all duration-200',
        sidebarOpen ? 'w-52' : 'w-14',
      )}
    >
      {/* Logo */}
      <div className={cn('flex h-14 items-center border-b border-border px-3', sidebarOpen ? 'gap-2.5' : 'justify-center')}>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent">
          <Zap className="h-4 w-4 text-black" fill="currentColor" />
        </div>
        {sidebarOpen && (
          <span className="text-sm font-semibold text-slate-100 tracking-tight">DevPulse</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 p-2 pt-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
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
