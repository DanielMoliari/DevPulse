'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isAuthenticated } from '@/lib/auth'
import { LoadingScreen } from '@/components/loading-screen'

export function AuthRedirect() {
  const router = useRouter()
  const [redirecting, setRedirecting] = useState(false)

  useEffect(() => {
    if (!isAuthenticated()) return
    setRedirecting(true)
    const id = setTimeout(() => router.replace('/dashboard'), 2500)
    return () => clearTimeout(id)
  }, [router])

  if (!redirecting) return null

  return (
    <LoadingScreen
      message="Welcome back"
      subMessage="Taking you to your dashboard…"
    />
  )
}
