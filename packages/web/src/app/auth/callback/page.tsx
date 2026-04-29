'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Zap } from 'lucide-react'
import { setToken } from '@/lib/auth'

function CallbackInner() {
  const router = useRouter()
  const params = useSearchParams()

  useEffect(() => {
    const token = params.get('token')
    const error = params.get('error')
    if (token) {
      setToken(token)
      router.replace('/dashboard')
    } else {
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
