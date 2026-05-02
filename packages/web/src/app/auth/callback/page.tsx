'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Zap } from 'lucide-react'
import { setToken } from '@/lib/auth'

function CallbackInner() {
  const router = useRouter()
  const params = useSearchParams()

  useEffect(() => {
    // useSearchParams can be empty on the very first client render in Next 15 — fall back to window.location
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
    const token = params.get('token') ?? urlParams?.get('token') ?? null
    const error = params.get('error') ?? urlParams?.get('error') ?? null
    console.log('[auth/callback] token:', !!token, 'len:', token?.length, 'error:', error, 'href:', typeof window !== 'undefined' ? window.location.href : 'ssr')
    if (token) {
      setToken(token)
      console.log('[auth/callback] saved token, navigating to /dashboard')
      // Use a hard navigation to ensure Apollo Client picks up the new token in localStorage
      window.location.replace('/dashboard')
    } else {
      console.warn('[auth/callback] no token found, redirecting to landing')
      router.replace(`/?error=${error ?? 'auth_failed'}`)
    }
  }, [router, params])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent shadow-lg shadow-accent/20">
        <Zap className="h-6 w-6 text-black" fill="currentColor" />
      </div>
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      <p className="text-sm text-slate-500">Completing authentication…</p>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-bg">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      }
    >
      <CallbackInner />
    </Suspense>
  )
}
