'use client'

import { useState } from 'react'
import { useMutation } from '@apollo/client/react'
import { CheckCircle2, ArrowRight, Loader2 } from 'lucide-react'
import { JOIN_WAITLIST } from '@/graphql/mutations'
import type { WaitlistEntry } from '@/graphql/types'

interface TeamWaitlistFormProps {
  source?: string
  compact?: boolean
}

export function TeamWaitlistForm({ source = 'landing', compact = false }: TeamWaitlistFormProps) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [teamSize, setTeamSize] = useState('')
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [joinWaitlist, { loading }] = useMutation<{ joinWaitlist: WaitlistEntry }>(JOIN_WAITLIST, {
    onCompleted: () => setSuccess(true),
    onError: (e) => setError(e.message.replace(/^.*?:\s*/, '')),
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setError(null)
    await joinWaitlist({
      variables: {
        input: {
          email: email.trim(),
          name: name.trim() || undefined,
          company: company.trim() || undefined,
          teamSize: teamSize || undefined,
          source,
        },
      },
    })
  }

  if (success) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-5 py-4">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
        <div>
          <p className="text-sm font-semibold text-emerald-300">Você está na lista!</p>
          <p className="text-xs text-slate-500 mt-0.5">Vamos avisar quando o Team Plan for lançado.</p>
        </div>
      </div>
    )
  }

  if (compact) {
    return (
      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-2 w-full max-w-md mx-auto">
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            required
            className="flex-1 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-violet-500/50 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 hover:bg-violet-500 transition-colors disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Entrar na waitlist <ArrowRight className="h-4 w-4" /></>}
          </button>
        </div>
        {error && <p className="text-xs text-red-400 text-center">{error}</p>}
      </form>
    )
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3 w-full max-w-sm">
      <div className="grid grid-cols-2 gap-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Seu nome"
          className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-violet-500/50 focus:outline-none"
        />
        <input
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Empresa"
          className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-violet-500/50 focus:outline-none"
        />
      </div>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="email@empresa.com"
        required
        className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-violet-500/50 focus:outline-none"
      />
      <select
        value={teamSize}
        onChange={(e) => setTeamSize(e.target.value)}
        className="w-full cursor-pointer rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-slate-400 focus:outline-none"
      >
        <option value="">Tamanho do time (opcional)</option>
        <option value="1-5">1–5 devs</option>
        <option value="6-20">6–20 devs</option>
        <option value="21-50">21–50 devs</option>
        <option value="50+">50+ devs</option>
      </select>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full cursor-pointer rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 hover:bg-violet-500 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Entrar na waitlist <ArrowRight className="h-4 w-4" /></>}
      </button>
      <p className="text-center text-[11px] text-slate-700">Sem spam. Sem cobrança até o lançamento.</p>
    </form>
  )
}
