'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { useLazyQuery } from '@apollo/client/react'
import { Search, X, Loader2, ExternalLink, GitBranch, Flame, Star, MapPin, Users } from 'lucide-react'
import { SEARCH_PROFILE_QUERY } from '@/graphql/queries'
import { languageColor } from '@/lib/utils'

interface SearchResult {
  source: string
  username: string
  displayName: string
  avatarUrl?: string | null
  bio?: string | null
  location?: string | null
  followers?: number | null
  publicRepos?: number | null
  totalCommits?: number | null
  currentStreak?: number | null
  topLanguages?: { name: string; percent: number }[] | null
  topRepos?: { fullName: string; language?: string | null; stargazersCount: number }[] | null
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

// Strip any github.com prefix the user may have typed
function normalizeInput(raw: string): string {
  return raw
    .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
    .replace(/^github\.com\//i, '')
    .replace(/\/+$/, '')
    .trim()
}

// "owner/repo" → repo mode, otherwise → user mode
function parseMode(normalized: string): { mode: 'repo'; owner: string; repo: string } | { mode: 'user'; username: string } {
  const slash = normalized.indexOf('/')
  if (slash > 0 && slash < normalized.length - 1) {
    return { mode: 'repo', owner: normalized.slice(0, slash), repo: normalized.slice(slash + 1) }
  }
  return { mode: 'user', username: normalized }
}

export function GlobalSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [raw, setRaw] = useState('')          // exactly what user typed
  const [mounted, setMounted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const prefixRef = useRef<HTMLSpanElement>(null)

  const normalized = normalizeInput(raw)
  const parsed = parseMode(normalized)
  const debounced = useDebounce(normalized, 480)
  const debouncedParsed = parseMode(debounced)

  const [search, { data, loading }] = useLazyQuery<{ searchProfile: SearchResult | null }>(
    SEARCH_PROFILE_QUERY,
    { fetchPolicy: 'no-cache' },
  )

  useEffect(() => { setMounted(true) }, [])

  const openModal = useCallback(() => {
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const closeModal = useCallback(() => {
    setOpen(false)
    setRaw('')
  }, [])

  // ⌘K / Ctrl+K + Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); openModal() }
      if (e.key === 'Escape') closeModal()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [openModal, closeModal])

  // Search when debounced user query is ready
  useEffect(() => {
    if (debouncedParsed.mode === 'user' && debouncedParsed.username.length >= 2) {
      void search({ variables: { query: debouncedParsed.username } })
    }
  }, [debounced]) // intentionally omit `search` — useLazyQuery returns a new fn ref each render

  const result = data?.searchProfile ?? null

  const navigateUser = useCallback(() => {
    if (!result) return
    router.push(`/u/${result.username}`)
    closeModal()
  }, [result, router, closeModal])

  const navigateRepo = useCallback(() => {
    if (parsed.mode !== 'repo') return
    router.push(`/r/${parsed.owner}/${parsed.repo}`)
    closeModal()
  }, [parsed, router, closeModal])

  const handleEnter = useCallback(() => {
    if (parsed.mode === 'repo') { navigateRepo(); return }
    navigateUser()
  }, [parsed, navigateRepo, navigateUser])

  // Active search query for display
  const isRepoMode = debouncedParsed.mode === 'repo'
  const isUserMode = debouncedParsed.mode === 'user' && debouncedParsed.username.length >= 2
  const showNotFound = isUserMode && !loading && !result

  const modal = open && mounted ? createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] px-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal() }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <div className="relative w-full max-w-[580px] overflow-hidden rounded-2xl border border-white/10 bg-[#0d1117] shadow-2xl">

        {/* Input row with ghost prefix */}
        <div className="flex items-center gap-0 px-4 py-3.5 border-b border-white/[0.06]">
          <Search className="h-4 w-4 shrink-0 text-slate-500 mr-3" />

          {/* Prefix + input in one visual unit */}
          <div className="flex flex-1 items-center min-w-0 font-mono text-sm">
            <span
              ref={prefixRef}
              className="shrink-0 select-none text-slate-600 pointer-events-none"
            >
              github.com/
            </span>
            <input
              ref={inputRef}
              value={raw}
              onChange={(e) => {
                let val = e.target.value
                // If user pastes a full URL, normalise immediately
                if (/^https?:\/\//i.test(val)) {
                  val = normalizeInput(val)
                }
                setRaw(val)
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleEnter()}
              placeholder={parsed.mode === 'repo' || raw.includes('/') ? 'username/repo' : 'username or username/repo'}
              className="flex-1 min-w-0 bg-transparent text-slate-100 placeholder-slate-700 outline-none"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-600 shrink-0 ml-2" />}
          {raw && !loading && (
            <button onClick={() => setRaw('')} className="cursor-pointer text-slate-600 hover:text-slate-400 shrink-0 ml-2">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <kbd
            onClick={closeModal}
            className="cursor-pointer shrink-0 ml-2 rounded border border-white/10 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-slate-600 hover:text-slate-400"
          >
            esc
          </kbd>
        </div>

        {/* Mode hint bar */}
        {normalized && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.04] text-[11px]">
            {parsed.mode === 'repo' ? (
              <>
                <GitBranch className="h-3 w-3 text-slate-600" />
                <span className="text-slate-600">Repository</span>
                <span className="font-mono text-slate-400">{parsed.owner}/</span>
                <span className="font-mono font-semibold text-slate-200">{parsed.repo}</span>
                <span className="ml-auto text-slate-700">↵ view analysis</span>
              </>
            ) : (
              <>
                <Users className="h-3 w-3 text-slate-600" />
                <span className="text-slate-600">Developer</span>
                <span className="font-mono text-slate-400">{normalized}</span>
                {normalized.length < 2 && (
                  <span className="ml-auto text-slate-700">type at least 2 characters</span>
                )}
              </>
            )}
          </div>
        )}

        {/* Repo mode card */}
        {isRepoMode && !loading && (
          <button
            className="w-full cursor-pointer text-left group"
            onClick={navigateRepo}
          >
            <div className="p-4 flex items-center gap-3 transition-colors group-hover:bg-white/[0.025]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04]">
                <GitBranch className="h-4 w-4 text-slate-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm font-medium text-slate-100">
                  {debouncedParsed.mode === 'repo' ? debouncedParsed.owner : parsed.mode === 'repo' ? parsed.owner : ''}
                  <span className="text-slate-500">/</span>
                  {debouncedParsed.mode === 'repo' ? debouncedParsed.repo : parsed.mode === 'repo' ? parsed.repo : ''}
                </p>
                <p className="mt-0.5 text-xs text-slate-600">View repository analysis</p>
              </div>
            </div>
            <div className="border-t border-white/[0.05] px-4 py-2 flex items-center justify-between text-[11px] text-slate-700">
              <span>Opens full repo analysis</span>
              <kbd className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px]">↵</kbd>
            </div>
          </button>
        )}

        {/* Empty state */}
        {!normalized && (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-slate-600">Search any developer or repository</p>
            <div className="mt-3 flex justify-center gap-4 text-[11px] text-slate-700">
              <span><span className="font-mono text-slate-600">torvalds</span> → developer profile</span>
              <span><span className="font-mono text-slate-600">owner/repo</span> → repository</span>
            </div>
          </div>
        )}

        {/* Loading skeleton — user mode */}
        {isUserMode && loading && (
          <div className="p-4 space-y-3 animate-pulse">
            <div className="flex gap-3">
              <div className="h-11 w-11 rounded-full bg-white/[0.06] shrink-0" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-3.5 w-32 rounded bg-white/[0.06]" />
                <div className="h-3 w-24 rounded bg-white/[0.04]" />
              </div>
            </div>
            <div className="flex gap-2">
              {[48, 60, 40, 52].map((w) => (
                <div key={w} className="h-5 rounded-full bg-white/[0.04]" style={{ width: w }} />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-8 rounded-lg bg-white/[0.03]" />
              ))}
            </div>
          </div>
        )}

        {/* Not found */}
        {showNotFound && (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-slate-500">
              No developer found for{' '}
              <span className="font-mono text-slate-300">@{debouncedParsed.mode === 'user' ? debouncedParsed.username : ''}</span>
            </p>
            <p className="mt-1 text-xs text-slate-700">
              Try typing <span className="font-mono">{debouncedParsed.mode === 'user' ? debouncedParsed.username : ''}/repo</span> to open their repository instead
            </p>
          </div>
        )}

        {/* User result card */}
        {isUserMode && result && !loading && (
          <button
            className="w-full cursor-pointer text-left group"
            onClick={navigateUser}
          >
            <div className="p-4 space-y-3 transition-colors group-hover:bg-white/[0.025]">

              {/* Header */}
              <div className="flex items-center gap-3">
                {result.avatarUrl ? (
                  <img
                    src={result.avatarUrl}
                    alt={result.displayName}
                    className="h-11 w-11 shrink-0 rounded-full ring-2 ring-white/[0.08]"
                  />
                ) : (
                  <div className="h-11 w-11 shrink-0 rounded-full bg-white/[0.06] flex items-center justify-center text-slate-400 font-semibold text-sm">
                    {result.displayName[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-100 leading-none">{result.displayName}</span>
                    {result.source === 'devpulse' ? (
                      <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold text-accent leading-none">
                        reflog
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-500 leading-none">
                        GitHub
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 font-mono text-xs text-slate-500">@{result.username}</p>
                </div>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-700 group-hover:text-slate-500 transition-colors" />
              </div>

              {result.bio && (
                <p className="text-xs text-slate-500 line-clamp-1 leading-relaxed">{result.bio}</p>
              )}

              {/* Stats */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
                {result.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />{result.location}
                  </span>
                )}
                {result.followers != null && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />{result.followers.toLocaleString()} followers
                  </span>
                )}
                {result.publicRepos != null && (
                  <span className="flex items-center gap-1">
                    <GitBranch className="h-3 w-3" />{result.publicRepos} repos
                  </span>
                )}
                {result.currentStreak != null && result.currentStreak > 0 && (
                  <span className="flex items-center gap-1 text-orange-400">
                    <Flame className="h-3 w-3" />{result.currentStreak}d streak
                  </span>
                )}
                {result.totalCommits != null && (
                  <span className="flex items-center gap-1">
                    {result.totalCommits.toLocaleString()} commits
                  </span>
                )}
              </div>

              {/* Language pills */}
              {result.topLanguages && result.topLanguages.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {result.topLanguages.slice(0, 5).map((l) => (
                    <span
                      key={l.name}
                      className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{ backgroundColor: languageColor(l.name) + '20', color: languageColor(l.name) }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: languageColor(l.name) }} />
                      {l.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Top repos */}
              {result.topRepos && result.topRepos.length > 0 && (
                <div className="grid grid-cols-2 gap-1.5">
                  {result.topRepos.slice(0, 4).map((r) => (
                    <div
                      key={r.fullName}
                      className="flex items-center gap-1.5 rounded-lg border border-white/[0.05] bg-white/[0.02] px-2.5 py-1.5"
                    >
                      {r.language && (
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: languageColor(r.language) }} />
                      )}
                      <span className="truncate font-mono text-[10px] text-slate-400">
                        {r.fullName.split('/')[1]}
                      </span>
                      {r.stargazersCount > 0 && (
                        <span className="ml-auto flex items-center gap-0.5 shrink-0 text-[10px] text-slate-600">
                          <Star className="h-2.5 w-2.5" />{r.stargazersCount.toLocaleString()}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-white/[0.05] px-4 py-2.5 flex items-center justify-between text-[11px] text-slate-700">
              <span>View full profile</span>
              <kbd className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px]">↵</kbd>
            </div>
          </button>
        )}
      </div>
    </div>,
    document.body,
  ) : null

  return (
    <>
      <button
        onClick={openModal}
        className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-slate-500 transition-colors hover:border-border-2 hover:bg-surface-2 hover:text-slate-400"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Search developers…</span>
        <kbd className="hidden rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 sm:inline">
          ⌘K
        </kbd>
      </button>

      {modal}
    </>
  )
}
