'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@apollo/client/react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Share2, Copy, Check, ArrowRight, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ME_QUERY } from '@/graphql/queries'
import type { User } from '@/graphql/types'

// Pulled out of the dashboard so any page can drop it in. Reads `me` separately
// because the dashboard already queries it elsewhere — Apollo dedupes the cache hit.
export function ShareProfileButton() {
  const { data, loading } = useQuery<{ me: User }>(ME_QUERY)
  const [copied, setCopied] = useState(false)

  if (loading || !data?.me) {
    return null
  }

  const me = data.me

  // Not yet public → small CTA to settings
  if (!me.publicProfile || !me.username) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link href="/settings">
          <Share2 className="h-3.5 w-3.5" />
          Make public
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Button>
    )
  }

  const url = typeof window !== 'undefined'
    ? `${window.location.origin}/u/${me.username}`
    : `/u/${me.username}`

  function handleCopy() {
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="h-3.5 w-3.5" />
          Share profile
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 w-80 rounded-lg border border-border-2 bg-surface-2 p-4 shadow-lg animate-in fade-in-0 zoom-in-95"
        >
          <p className="mb-1 text-xs font-medium uppercase tracking-widest text-slate-500">
            Your shareable profile
          </p>
          <p className="mb-3 text-xs text-slate-600">
            Anyone can view a curated read-only version — no email or private repos.
          </p>
          <div className="flex items-center gap-2 rounded-md border border-accent/20 bg-accent/5 px-2.5 py-1.5">
            <span className="flex-1 truncate font-mono text-xs text-accent">{url}</span>
            <Button variant="ghost" size="icon-sm" onClick={handleCopy} title="Copy URL">
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
            <Button asChild variant="ghost" size="icon-sm" title="Open profile">
              <a href={`/u/${me.username}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
          <Link
            href="/settings"
            className="mt-3 block text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Manage public profile preferences →
          </Link>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
