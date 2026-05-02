import Link from 'next/link'
import { Zap } from 'lucide-react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:17642'

// Public profile pages live OUTSIDE the (app) route group so they don't pull in the
// authenticated sidebar/nav. This minimal layout is what an anonymous visitor sees.
export default function PublicProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="min-h-full bg-bg text-slate-100">
        <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent transition-transform group-hover:scale-105">
                <Zap className="h-4 w-4 text-black" fill="currentColor" />
              </div>
              <span className="font-semibold tracking-tight">DevPulse</span>
            </Link>
            <Button asChild size="sm" variant="outline">
              <a href={`${API_URL}/api/v1/auth/github`}>Sign in with GitHub</a>
            </Button>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
      </div>
    </TooltipProvider>
  )
}
