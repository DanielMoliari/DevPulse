'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Sidebar } from '@/components/sidebar'
import { NavHeader } from '@/components/nav-header'
import { isAuthenticated } from '@/lib/auth'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/')
  }, [router])

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full overflow-hidden bg-bg">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <NavHeader />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  )
}
