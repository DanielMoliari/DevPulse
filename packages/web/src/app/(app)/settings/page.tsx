'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation } from '@apollo/client/react'
import { Save, AlertTriangle, Mail, Bell, GitBranch, Send, Globe, Copy, Check, ExternalLink } from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ME_QUERY } from '@/graphql/queries'
import {
  UPDATE_PROFILE,
  UPDATE_NOTIFICATION_PREFS,
  SEND_TEST_DIGEST,
  ENABLE_PUBLIC_PROFILE,
  UPDATE_PUBLIC_PROFILE_PREFS,
  DISABLE_PUBLIC_PROFILE,
} from '@/graphql/mutations'
import type { User } from '@/graphql/types'
import { clearToken } from '@/lib/auth'

export default function SettingsPage() {
  const { data, loading } = useQuery<{ me: User }>(ME_QUERY)
  const [updateProfile, { loading: saving }] = useMutation(UPDATE_PROFILE, {
    refetchQueries: [ME_QUERY],
  })
  const [updateNotificationPrefs, { loading: savingPrefs }] = useMutation(UPDATE_NOTIFICATION_PREFS, {
    refetchQueries: [ME_QUERY],
  })
  const [sendTestDigest, { loading: sendingTest }] = useMutation(SEND_TEST_DIGEST)
  const [enablePublicProfile, { loading: enablingPublic }] = useMutation<
    { enablePublicProfile: User },
    { input: { username: string } }
  >(ENABLE_PUBLIC_PROFILE, { refetchQueries: [ME_QUERY] })
  const [updatePublicPrefs] = useMutation(UPDATE_PUBLIC_PROFILE_PREFS, { refetchQueries: [ME_QUERY] })
  const [disablePublicProfile, { loading: disablingPublic }] = useMutation(DISABLE_PUBLIC_PROFILE, {
    refetchQueries: [ME_QUERY],
  })

  const user = data?.me
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [weeklyDigest, setWeeklyDigest] = useState(true)
  const [streakAlerts, setStreakAlerts] = useState(true)
  const [testDigestState, setTestDigestState] = useState<'idle' | 'sent' | 'error'>('idle')
  const [usernameDraft, setUsernameDraft] = useState('')
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Populate form when user data loads
  if (user && name === '' && email === '') {
    if (user.name) setName(user.name)
    if (user.email) setEmail(user.email)
  }

  // Sync notification toggles from server once user loads
  useEffect(() => {
    if (!user) return
    setWeeklyDigest(user.notificationsEnabled)
    setStreakAlerts(user.streakAlertsEnabled)
  }, [user])

  function handleSave() {
    void updateProfile({ variables: { input: { name: name || undefined, email: email || undefined } } })
  }

  function handleToggleWeeklyDigest(next: boolean) {
    setWeeklyDigest(next)
    void updateNotificationPrefs({ variables: { input: { notificationsEnabled: next } } })
  }

  function handleToggleStreakAlerts(next: boolean) {
    setStreakAlerts(next)
    void updateNotificationPrefs({ variables: { input: { streakAlertsEnabled: next } } })
  }

  async function handleSendTestDigest() {
    try {
      await sendTestDigest()
      setTestDigestState('sent')
    } catch {
      setTestDigestState('error')
    }
    setTimeout(() => setTestDigestState('idle'), 4000)
  }

  function handleDisconnect() {
    clearToken()
    window.location.href = '/'
  }

  // ── Public profile handlers ─────────────────────────────────────────────
  const USERNAME_RE = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/i
  async function handleEnablePublic() {
    const candidate = usernameDraft.trim().toLowerCase()
    if (candidate.length < 3 || candidate.length > 30 || !USERNAME_RE.test(candidate)) {
      setUsernameError('3-30 chars, letters/digits/dashes, no leading or trailing dash.')
      return
    }
    try {
      setUsernameError(null)
      await enablePublicProfile({ variables: { input: { username: candidate } } })
    } catch (e) {
      // NestJS BadRequestException puts the real message under extensions.originalError.message.
      // Apollo Client v4 surfaces it as a CombinedGraphQLErrors with .errors[0].extensions.originalError
      const err = e as { graphQLErrors?: { extensions?: { originalError?: { message?: string | string[] } }; message?: string }[]; message?: string }
      const gqlErr = err.graphQLErrors?.[0]
      const orig = gqlErr?.extensions?.originalError?.message
      const msg = Array.isArray(orig) ? orig.join(' · ') : orig ?? gqlErr?.message ?? err.message ?? 'Could not enable public profile'
      setUsernameError(msg)
    }
  }

  function handleTogglePublicRepos(next: boolean) {
    void updatePublicPrefs({ variables: { input: { showRepos: next } } })
  }

  function handleTogglePublicStreak(next: boolean) {
    void updatePublicPrefs({ variables: { input: { showStreak: next } } })
  }

  function handleDisablePublic() {
    void disablePublicProfile()
  }

  function handleCopyUrl() {
    const url = publicUrl()
    if (!url) return
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  function publicUrl(): string | null {
    if (!user?.username) return null
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return `${origin}/u/${user.username}`
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

      {/* Public profile */}
      <Card>
        <CardHeader>
          <CardTitle>Public profile</CardTitle>
          {user?.publicProfile && <Badge variant="success">Live</Badge>}
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2">
                <Globe className="h-5 w-5 text-slate-300" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-200">Make my profile public</p>
                <p className="text-xs text-slate-600">
                  Share a curated read-only page at <span className="font-mono">/u/{'{username}'}</span>.
                  No email, no private repos.
                </p>
              </div>
            </div>
            <Switch
              checked={!!user?.publicProfile}
              onCheckedChange={(next) => {
                if (next && !user?.username) return // need username first
                if (next) {
                  // re-enable after disabling — server still has the username
                  void enablePublicProfile({ variables: { input: { username: user!.username! } } })
                } else {
                  handleDisablePublic()
                }
              }}
              disabled={loading || disablingPublic || enablingPublic || (!user?.publicProfile && !user?.username)}
            />
          </div>

          {/* No username yet → show input */}
          {!loading && !user?.username && (
            <div className="space-y-2 rounded-lg border border-border-2 bg-surface-2 p-4">
              <label className="block text-xs font-medium text-slate-400">Pick a public username</label>
              <div className="flex gap-2">
                <div className="flex flex-1 items-center rounded-md border border-border-2 bg-surface px-3">
                  <span className="font-mono text-xs text-slate-600">devpulse.app/u/</span>
                  <input
                    value={usernameDraft}
                    onChange={(e) => {
                      // Strip invalid chars on the way in so the user never sees a confusing rejection later
                      const cleaned = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30)
                      setUsernameDraft(cleaned)
                      if (usernameError) setUsernameError(null)
                    }}
                    placeholder="your-handle"
                    className="ml-1 h-9 flex-1 bg-transparent font-mono text-xs text-slate-200 outline-none placeholder:text-slate-700"
                  />
                </div>
                <Button
                  onClick={() => void handleEnablePublic()}
                  disabled={enablingPublic || !USERNAME_RE.test(usernameDraft) || usernameDraft.length < 3}
                  size="default"
                >
                  {enablingPublic ? 'Reserving…' : 'Enable'}
                </Button>
              </div>
              {usernameError ? (
                <p className="text-xs text-danger">{usernameError}</p>
              ) : usernameDraft.length === 0 ? (
                <p className="text-[11px] text-slate-600">3-30 characters · letters, numbers, dashes · once taken it&apos;s yours</p>
              ) : usernameDraft.length < 3 ? (
                <p className="text-[11px] text-amber-400">{3 - usernameDraft.length} more character{3 - usernameDraft.length !== 1 ? 's' : ''} needed</p>
              ) : !USERNAME_RE.test(usernameDraft) ? (
                <p className="text-[11px] text-amber-400">Cannot start or end with a dash</p>
              ) : (
                <p className="text-[11px] text-success">✓ <span className="font-mono">{usernameDraft}</span> looks good</p>
              )}
            </div>
          )}

          {/* Username exists and profile is public → show URL + section toggles */}
          {user?.publicProfile && user.username && (
            <>
              <div className="flex items-center gap-2 rounded-lg border border-accent/20 bg-accent/5 px-3 py-2.5">
                <span className="flex-1 truncate font-mono text-xs text-accent">{publicUrl()}</span>
                <Button variant="ghost" size="icon-sm" onClick={handleCopyUrl} title="Copy URL">
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
                <Button asChild variant="ghost" size="icon-sm" title="Open">
                  <a href={`/u/${user.username}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-200">Show tracked repositories</p>
                    <p className="text-xs text-slate-600">List of repos appears on your public page</p>
                  </div>
                  <Switch
                    checked={user.publicShowRepos}
                    onCheckedChange={handleTogglePublicRepos}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-200">Show streak</p>
                    <p className="text-xs text-slate-600">Current and longest streak counters</p>
                  </div>
                  <Switch
                    checked={user.publicShowStreak}
                    onCheckedChange={handleTogglePublicStreak}
                  />
                </div>
              </div>
            </>
          )}

          {/* Username reserved but profile disabled */}
          {!user?.publicProfile && user?.username && (
            <p className="text-xs text-slate-500">
              Username <span className="font-mono text-slate-300">@{user.username}</span> is reserved for you.
              Toggle on to publish your profile.
            </p>
          )}
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
                <p className="text-sm font-medium text-slate-200">Weekly digest email</p>
                <p className="text-xs text-slate-600">Sent every Monday at 9 AM</p>
              </div>
            </div>
            <Switch
              checked={weeklyDigest}
              onCheckedChange={handleToggleWeeklyDigest}
              disabled={loading || savingPrefs}
            />
          </div>
          <div className="h-px bg-border" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="h-4 w-4 text-slate-500" />
              <div>
                <p className="text-sm font-medium text-slate-200">Streak at-risk alerts</p>
                <p className="text-xs text-slate-600">When your streak is about to break</p>
              </div>
            </div>
            <Switch
              checked={streakAlerts}
              onCheckedChange={handleToggleStreakAlerts}
              disabled={loading || savingPrefs}
            />
          </div>
          <div className="h-px bg-border" />
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-200">Send a test digest</p>
              <p className="text-xs text-slate-600">Verify your email config without waiting until Monday</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleSendTestDigest()}
              disabled={sendingTest || !user?.email}
            >
              <Send className="h-3.5 w-3.5" />
              {sendingTest
                ? 'Sending…'
                : testDigestState === 'sent'
                  ? 'Sent!'
                  : testDigestState === 'error'
                    ? 'Failed — retry'
                    : 'Send test'}
            </Button>
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
