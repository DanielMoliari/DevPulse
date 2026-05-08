'use client'

import React, { useEffect, useState } from 'react'
import { useQuery, useMutation } from '@apollo/client/react'
import { Save, Bell, GitBranch, Copy, Check, ExternalLink, User, Trash2 } from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ME_QUERY, REPOSITORIES_QUERY } from '@/graphql/queries'
import {
  UPDATE_PROFILE,
  UPDATE_NOTIFICATION_PREFS,
} from '@/graphql/mutations'
import type { User as UserType } from '@/graphql/types'
import { clearToken } from '@/lib/auth'

type Section = 'profile' | 'connections' | 'notifications' | 'danger'

interface NavItem {
  id: Section
  label: string
  Icon: React.ComponentType<{ className?: string }>
  danger?: boolean
}

interface NavGroup {
  label: string
  danger?: boolean
  items: NavItem[]
}

interface Repository {
  id: string
  fullName: string
  lastSyncedAt: string | null
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Account',
    items: [
      { id: 'profile' as Section, label: 'Profile', Icon: User },
      { id: 'connections' as Section, label: 'Connections', Icon: GitBranch },
    ],
  },
  {
    label: 'Preferences',
    items: [
      { id: 'notifications' as Section, label: 'Notifications', Icon: Bell },
    ],
  },
  {
    label: 'Danger',
    danger: true,
    items: [
      { id: 'danger' as Section, label: 'Delete account', Icon: Trash2, danger: true },
    ],
  },
]

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<Section>('profile')

  const { data, loading } = useQuery<{ me: UserType }>(ME_QUERY)
  const { data: reposData } = useQuery<{ repositories: Repository[] }>(REPOSITORIES_QUERY)

  const [updateProfile, { loading: saving }] = useMutation(UPDATE_PROFILE, {
    refetchQueries: [ME_QUERY],
  })
  const [updateNotificationPrefs, { loading: savingPrefs }] = useMutation(UPDATE_NOTIFICATION_PREFS, {
    refetchQueries: [ME_QUERY],
  })
  const user = data?.me
  const repos = reposData?.repositories ?? []

  const [name, setName] = useState('')
  const [weeklyDigest, setWeeklyDigest] = useState(true)
  const [streakAlerts, setStreakAlerts] = useState(true)
  const [milestoneAlerts, setMilestoneAlerts] = useState(true)
  const [copied, setCopied] = useState(false)

  // Populate form when user data loads
  if (user && name === '') {
    if (user.name) setName(user.name)
  }

  // Sync notification toggles from server once user loads
  useEffect(() => {
    if (!user) return
    setWeeklyDigest(user.notificationsEnabled)
    setStreakAlerts(user.streakAlertsEnabled)
  }, [user])

  function handleSave() {
    void updateProfile({ variables: { input: { name: name || undefined } } })
  }

  function handleToggleWeeklyDigest(next: boolean) {
    setWeeklyDigest(next)
    void updateNotificationPrefs({ variables: { input: { notificationsEnabled: next } } })
  }

  function handleToggleStreakAlerts(next: boolean) {
    setStreakAlerts(next)
    void updateNotificationPrefs({ variables: { input: { streakAlertsEnabled: next } } })
  }

  function handleDisconnect() {
    clearToken()
    window.location.href = '/'
  }

  function handleCopyUrl() {
    if (!user?.username) return
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/u/${user.username}`
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.username?.slice(0, 2).toUpperCase() ?? '?'

  // Most recent lastSyncedAt across all repos
  const lastSyncedAt = repos
    .map((r) => r.lastSyncedAt)
    .filter(Boolean)
    .sort()
    .at(-1)

  // ── Section renderers ─────────────────────────────────────────────────────

  function renderProfile() {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Profile</h2>
          <p className="mt-0.5 text-xs text-slate-500">Manage how your name appears across reflog.</p>
        </div>

        {/* Avatar row */}
        <div className="flex items-center gap-4">
          {loading ? (
            <Skeleton className="h-14 w-14 rounded-full" />
          ) : (
            <Avatar className="h-14 w-14">
              <AvatarImage src={user?.avatarUrl ?? undefined} />
              <AvatarFallback className="text-base">{initials}</AvatarFallback>
            </Avatar>
          )}
          <div>
            {loading ? (
              <>
                <Skeleton className="mb-1 h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </>
            ) : (
              <>
                <p className="font-medium text-slate-100">{user?.name ?? user?.username}</p>
                <p className="text-xs text-slate-500">@{user?.username}</p>
              </>
            )}
          </div>
          {user?.plan === 'PRO' && <Badge variant="accent" className="ml-auto">Pro</Badge>}
        </div>

        <div className="space-y-4">
          {/* Public profile URL */}
          {user?.username && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Public profile URL</label>
              <div className="flex items-center gap-2 rounded-md border border-border-2 bg-surface px-3 py-2 max-w-sm">
                <span className="flex-1 truncate font-mono text-xs text-slate-400">
                  {typeof window !== 'undefined' ? window.location.origin : ''}/u/{user.username}
                </span>
                <Button variant="ghost" size="icon-sm" onClick={handleCopyUrl}>
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
                <Button asChild variant="ghost" size="icon-sm" title="Open">
                  <a href={`/u/${user.username}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>
              <p className="mt-1 text-[11px] text-slate-600">Your handle comes from GitHub — not editable</p>
            </div>
          )}

          {/* Display name */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Display name</label>
            {loading ? <Skeleton className="h-9 w-full" /> : (
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            )}
          </div>

        </div>

        <Button onClick={handleSave} disabled={saving || loading} size="sm">
          <Save className="h-3.5 w-3.5" />
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    )
  }

  function renderConnections() {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Connections</h2>
          <p className="mt-0.5 text-xs text-slate-500">Manage connected services and sync preferences.</p>
        </div>

        {/* GitHub card */}
        <div className="rounded-lg border border-border-2 bg-surface p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {loading ? (
                <Skeleton className="h-10 w-10 rounded-full" />
              ) : (
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user?.avatarUrl ?? undefined} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              )}
              <div>
                <p className="text-sm font-medium text-slate-200">GitHub</p>
                {loading ? (
                  <Skeleton className="mt-0.5 h-3 w-36" />
                ) : (
                  <p className="text-xs text-slate-500">
                    @{user?.username} · Connected
                    {repos.length > 0 && ` · ${repos.length} ${repos.length === 1 ? 'repository' : 'repositories'}`}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="success">Active</Badge>
              <Button variant="outline" size="sm" onClick={handleDisconnect}>
                Disconnect
              </Button>
            </div>
          </div>

          {/* Sync toggles — UI only */}
          <div className="border-t border-border pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-200">Auto-sync every 6 hours</p>
                <p className="text-[11px] text-slate-600">Keeps your metrics up to date automatically</p>
              </div>
              <Switch disabled checked={false} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-200">Sync on login</p>
                <p className="text-[11px] text-slate-600">Trigger a sync each time you sign in</p>
              </div>
              <Switch disabled checked={false} />
            </div>
          </div>

          {/* Last synced */}
          {lastSyncedAt && (
            <p className="text-[11px] text-slate-600">
              Last synced{' '}
              {new Date(lastSyncedAt).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>
      </div>
    )
  }

  function renderNotifications() {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Notifications</h2>
          <p className="mt-0.5 text-xs text-slate-500">Choose what reflog notifies you about.</p>
        </div>

        <div className="space-y-0 rounded-lg border border-border-2 bg-surface divide-y divide-border">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-xs font-medium text-slate-200">Streak at risk</p>
              <p className="text-[11px] text-slate-600">When your streak is about to break</p>
            </div>
            <Switch
              checked={streakAlerts}
              onCheckedChange={handleToggleStreakAlerts}
              disabled={loading || savingPrefs}
            />
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-xs font-medium text-slate-200">New milestone reached</p>
              <p className="text-[11px] text-slate-600">Personal bests and achievement unlocks</p>
            </div>
            <Switch
              checked={milestoneAlerts}
              onCheckedChange={setMilestoneAlerts}
            />
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-xs font-medium text-slate-200">Weekly digest</p>
              <p className="text-[11px] text-slate-600">Summary of your week, sent every Monday at 9 AM</p>
            </div>
            <Switch
              checked={weeklyDigest}
              onCheckedChange={handleToggleWeeklyDigest}
              disabled={loading || savingPrefs}
            />
          </div>
        </div>
      </div>
    )
  }

  function renderDanger() {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-sm font-semibold text-danger">Danger zone</h2>
          <p className="mt-0.5 text-xs text-slate-500">Irreversible actions — proceed with care.</p>
        </div>

        {/* Sign out */}
        <div className="rounded-lg border border-border-2 bg-surface p-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-slate-200">Sign out of reflog</p>
            <p className="text-[11px] text-slate-600 mt-0.5">You can always reconnect your GitHub account.</p>
          </div>
          <Button variant="destructive" size="sm" onClick={handleDisconnect}>
            Sign out
          </Button>
        </div>

        {/* Delete account placeholder */}
        <div className="rounded-lg border border-danger/20 bg-danger/5 p-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-slate-200">Delete account</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Account deletion is permanent and cannot be undone. Contact support to delete your account.
            </p>
          </div>
          <Button variant="destructive" size="sm" disabled>
            Delete account
          </Button>
        </div>
      </div>
    )
  }

  const sectionContent: Record<Section, () => React.ReactNode> = {
    profile: renderProfile,
    connections: renderConnections,
    notifications: renderNotifications,
    danger: renderDanger,
  }

  const allItems = NAV_GROUPS.flatMap((g) => g.items)

  return (
    <div className="max-w-2xl space-y-6">
      {/* Horizontal tab nav */}
      <nav className="flex items-center gap-1 border-b border-border pb-0">
        {allItems.map(({ id, label, Icon, danger }) => {
          const isActive = activeSection === id
          return (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={[
                'flex items-center gap-1.5 px-3 py-2 text-xs font-medium cursor-pointer transition-colors border-b-2 -mb-px',
                isActive
                  ? danger
                    ? 'border-danger text-danger'
                    : 'border-accent text-accent'
                  : danger
                    ? 'border-transparent text-danger/50 hover:text-danger'
                    : 'border-transparent text-slate-500 hover:text-slate-300',
              ].join(' ')}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {label}
            </button>
          )
        })}
      </nav>

      {/* Section content */}
      <div>
        {sectionContent[activeSection]()}
      </div>
    </div>
  )
}
