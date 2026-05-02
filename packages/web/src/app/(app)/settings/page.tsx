'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@apollo/client/react'
import { Save, AlertTriangle, Mail, Bell, GitBranch } from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ME_QUERY } from '@/graphql/queries'
import { UPDATE_PROFILE } from '@/graphql/mutations'
import type { User } from '@/graphql/types'
import { clearToken } from '@/lib/auth'

export default function SettingsPage() {
  const { data, loading } = useQuery<{ me: User }>(ME_QUERY)
  const [updateProfile, { loading: saving }] = useMutation(UPDATE_PROFILE, {
    refetchQueries: [ME_QUERY],
  })

  const user = data?.me
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [weeklyDigest, setWeeklyDigest] = useState(true)
  const [streakAlerts, setStreakAlerts] = useState(true)

  // Populate form when user data loads
  if (user && name === '' && email === '') {
    if (user.name) setName(user.name)
    if (user.email) setEmail(user.email)
  }

  function handleSave() {
    void updateProfile({ variables: { input: { name: name || undefined, email: email || undefined } } })
  }

  function handleDisconnect() {
    clearToken()
    window.location.href = '/'
  }

  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.username?.slice(0, 2).toUpperCase() ?? '?'

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
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
                  <p className="text-sm text-slate-500">@{user?.username}</p>
                </>
              )}
            </div>
            {user?.plan === 'PRO' && <Badge variant="accent" className="ml-auto">Pro</Badge>}
          </div>

          <div className="space-y-3">
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
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Email address</label>
              {loading ? <Skeleton className="h-9 w-full" /> : (
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              )}
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving || loading} size="sm">
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </CardContent>
      </Card>

      {/* Connected account */}
      <Card>
        <CardHeader>
          <CardTitle>Connected account</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2">
                <GitBranch className="h-5 w-5 text-slate-300" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-200">GitHub</p>
                {loading ? (
                  <Skeleton className="mt-0.5 h-3 w-28" />
                ) : (
                  <p className="text-xs text-slate-500">@{user?.username}</p>
                )}
              </div>
            </div>
            <Badge variant="success">Connected</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-slate-500" />
              <div>
                <p className="text-sm font-medium text-slate-200">Weekly digest</p>
                <p className="text-xs text-slate-600">Summary of your week sent every Monday</p>
              </div>
            </div>
            <Switch checked={weeklyDigest} onCheckedChange={setWeeklyDigest} />
          </div>
          <div className="h-px bg-border" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="h-4 w-4 text-slate-500" />
              <div>
                <p className="text-sm font-medium text-slate-200">Streak alerts</p>
                <p className="text-xs text-slate-600">Get reminded before your streak breaks</p>
              </div>
            </div>
            <Switch checked={streakAlerts} onCheckedChange={setStreakAlerts} />
          </div>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-danger/20">
        <CardHeader>
          <CardTitle className="text-danger">Danger zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3 rounded-lg border border-danger/10 bg-danger/5 p-4">
            <AlertTriangle className="h-4 w-4 shrink-0 text-danger mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200">Sign out of DevPulse</p>
              <p className="mt-0.5 text-xs text-slate-500">
                You can always reconnect your GitHub account.
              </p>
            </div>
            <Button variant="destructive" size="sm" onClick={handleDisconnect}>
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
