'use client'

import { useState } from 'react'
import { Code2, Copy, Check } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Button } from '@/components/ui/button'

interface EmbedCardButtonProps {
  username: string
}

export function EmbedCardButton({ username }: EmbedCardButtonProps) {
  const [copied, setCopied] = useState(false)

  const cardUrl = `https://devpulse.app/api/v1/card/${username}`
  const markdown = `![DevPulse card](${cardUrl})`

  function handleCopy() {
    void navigator.clipboard.writeText(markdown).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="outline" size="sm">
          <Code2 className="h-3.5 w-3.5" />
          Embed card
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="z-50 w-80 rounded-lg border border-border-2 bg-surface-2 p-4 shadow-lg animate-in fade-in-0 zoom-in-95"
        >
          <p className="mb-1 text-xs font-medium uppercase tracking-widest text-slate-500">
            Embed in your README
          </p>
          <p className="mb-3 text-xs text-slate-600">
            Paste this markdown into any GitHub README — the card auto-updates every hour.
          </p>
          <div className="flex items-center gap-2 rounded-md border border-accent/20 bg-accent/5 px-2.5 py-1.5">
            <span className="flex-1 truncate font-mono text-[11px] text-accent">{markdown}</span>
            <Button variant="ghost" size="icon-sm" onClick={handleCopy} title="Copy markdown">
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
