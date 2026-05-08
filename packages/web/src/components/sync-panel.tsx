'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Circle, AlertCircle, RefreshCw, X, ChevronUp, ChevronDown } from 'lucide-react'
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { REPOSITORIES_QUERY } from '@/graphql/queries'
import { SYNC_REPOSITORY } from '@/graphql/mutations'
import type { Repository } from '@/graphql/types'

interface SyncPanelProps {
  open: boolean
  onClose: () => void
}

type RepoSyncStatus = 'queued' | 'syncing' | 'done' | 'error'

interface RepoRow {
  id: string
  fullName: string
  status: RepoSyncStatus
}

const STATUS_ORDER: Record<RepoSyncStatus, number> = {
  syncing: 0,
  queued:  1,
  done:    2,
  error:   3,
}

function RepoChip({ row }: { row: RepoRow }) {
  const shortName = row.fullName.split('/')[1] ?? row.fullName

  if (row.status === 'done') {
    return (
      <div className="flex items-center gap-1.5 rounded-md border border-success/20 bg-success/5 px-2 py-1 text-[11px] text-success">
        <CheckCircle2 className="h-3 w-3 shrink-0" />
        <span className="max-w-[100px] truncate">{shortName}</span>
      </div>
    )
  }
  if (row.status === 'error') {
    return (
      <div className="flex items-center gap-1.5 rounded-md border border-danger/20 bg-danger/5 px-2 py-1 text-[11px] text-danger">
        <AlertCircle className="h-3 w-3 shrink-0" />
        <span className="max-w-[100px] truncate">{shortName}</span>
      </div>
    )
  }
  if (row.status === 'syncing') {
    return (
      <div className="flex items-center gap-1.5 rounded-md border border-accent/20 bg-accent/5 px-2 py-1 text-[11px] text-accent">
        <RefreshCw className="h-3 w-3 shrink-0 animate-spin" />
        <span className="max-w-[100px] truncate">{shortName}</span>
      </div>
    )
  }
  return null
}

export function SyncPanel({ open, onClose }: SyncPanelProps) {
  const apollo = useApolloClient()
  const { data, refetch } = useQuery<{ repositories: Repository[] }>(
    REPOSITORIES_QUERY,
    { fetchPolicy: 'cache-and-network' },
  )
  const [syncRepository] = useMutation(SYNC_REPOSITORY)

  const [rows, setRows] = useState<RepoRow[]>([])
  const [expanded, setExpanded] = useState(false)
  const pollRef        = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedRef     = useRef(false)
  const sessionStart   = useRef<number>(0)
  const seenSyncingRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!open) return
    const repos = (data?.repositories ?? []).filter((r) => r.isTracked)
    seenSyncingRef.current = new Set()
    sessionStart.current = Date.now()
    startedRef.current = false
    setExpanded(false)
    setRows(repos.map((r) => ({
      id: r.id,
      fullName: r.fullName,
      status: r.syncState === 'SYNCING' ? 'syncing' : 'queued',
    })))
  }, [open])

  useEffect(() => {
    if (!open || rows.length === 0 || startedRef.current) return
    startedRef.current = true
    void triggerAll()
  }, [open, rows.length])

  async function triggerAll() {
    const repos = ((await refetch()).data?.repositories ?? []).filter((r) => r.isTracked)
    await Promise.allSettled(repos.map((r) => syncRepository({ variables: { id: r.id } })))

    pollRef.current = setInterval(async () => {
      const result = await refetch()
      const fresh = result.data?.repositories ?? []

      setRows((prev) => {
        const next = prev.map((row) => {
          const live = fresh.find((r) => r.id === row.id)
          if (!live) return row
          if (live.syncState === 'SYNCING') {
            seenSyncingRef.current.add(row.id)
            return { ...row, status: 'syncing' as const }
          }
          if (live.syncState === 'ERROR') return { ...row, status: 'error' as const }
          if (seenSyncingRef.current.has(row.id)) return { ...row, status: 'done' as const }
          if (live.lastSyncedAt && new Date(live.lastSyncedAt).getTime() >= sessionStart.current) {
            return { ...row, status: 'done' as const }
          }
          return row
        })
        return [...next].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
      })

      const trackedFresh = fresh.filter((r) => r.isTracked)
      const stillRunning = trackedFresh.some((r) => r.syncState === 'SYNCING')
      const allFinished  = trackedFresh.every(
        (r) => r.syncState !== 'SYNCING' &&
               (seenSyncingRef.current.has(r.id) ||
                (r.lastSyncedAt && new Date(r.lastSyncedAt).getTime() >= sessionStart.current)),
      )

      if (!stillRunning && allFinished) {
        clearInterval(pollRef.current!)
        pollRef.current = null
        setRows((prev) =>
          [...prev.map((r) => r.status === 'queued' ? { ...r, status: 'done' as const } : r)]
            .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
        )
        await apollo.refetchQueries({ include: 'active' })
      }
    }, 1500)
  }

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  if (!open) return null

  const done     = rows.filter((r) => r.status === 'done').length
  const errors   = rows.filter((r) => r.status === 'error').length
  const total    = rows.length
  const allDone  = total > 0 && rows.every((r) => r.status === 'done' || r.status === 'error')
  const progress = total > 0 ? Math.round((done / total) * 100) : 0

  // chips: active (syncing) first, then done, skip queued in bar
  const activeChips = rows.filter((r) => r.status === 'syncing' || r.status === 'error')
  const doneChips   = rows.filter((r) => r.status === 'done')
  const visibleChips = [...activeChips, ...doneChips].slice(0, 4)
  const hiddenCount  = rows.filter((r) => r.status === 'queued').length + Math.max(0, activeChips.length + doneChips.length - 4)

  return (
    <div className="border-t border-border bg-surface">
      {/* Progress bar — top of the bar */}
      <div className="h-px w-full bg-surface-2">
        <div
          className="h-full transition-all duration-700"
          style={{
            width: `${progress}%`,
            backgroundColor: allDone
              ? (errors > 0 ? 'var(--color-danger)' : 'var(--color-success)')
              : 'var(--color-accent)',
          }}
        />
      </div>

      {/* Main bar row */}
      <div className="flex items-center gap-3 px-5 py-2.5">

        {/* Left: status icon + label + count */}
        <div className="flex items-center gap-2 shrink-0">
          {allDone ? (
            errors > 0
              ? <AlertCircle className="h-3.5 w-3.5 shrink-0 text-danger" />
              : <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin text-accent" />
          )}
          <span className={`text-xs font-semibold tabular shrink-0 ${allDone ? (errors > 0 ? 'text-danger' : 'text-success') : 'text-accent'}`}>
            {allDone
              ? (errors > 0 ? `${errors} error${errors > 1 ? 's' : ''}` : 'All synced')
              : `${done}/${total}`}
          </span>
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-border-2 shrink-0" />

        {/* Repo chips — active + done */}
        <div className="flex flex-1 items-center gap-1.5 overflow-hidden min-w-0">
          {visibleChips.map((row) => (
            <RepoChip key={row.id} row={row} />
          ))}
          {hiddenCount > 0 && (
            <span className="shrink-0 text-[11px] text-slate-600">+{hiddenCount} queued</span>
          )}
          {visibleChips.length === 0 && !allDone && (
            <span className="text-[11px] text-slate-600">Starting…</span>
          )}
        </div>

        {/* Right: expand + close */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-slate-600 transition-colors hover:bg-surface-2 hover:text-slate-300"
            title={expanded ? 'Collapse' : 'Show all repos'}
          >
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={onClose}
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-slate-600 transition-colors hover:bg-surface-2 hover:text-slate-300"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Expanded repo list */}
      {expanded && (
        <ul className="max-h-52 overflow-y-auto border-t border-border px-4 pb-3 pt-2">
          {rows.map((row) => {
            const shortName = row.fullName.split('/')[1] ?? row.fullName
            return (
              <li
                key={row.id}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-surface-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {row.status === 'done'    && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />}
                  {row.status === 'error'   && <AlertCircle  className="h-3.5 w-3.5 shrink-0 text-danger" />}
                  {row.status === 'syncing' && <RefreshCw    className="h-3.5 w-3.5 shrink-0 animate-spin text-accent" />}
                  {row.status === 'queued'  && <Circle       className="h-3.5 w-3.5 shrink-0 text-slate-700" />}
                  <span className="truncate text-xs text-slate-400">{shortName}</span>
                </div>
                <span className={`shrink-0 text-[11px] tabular ${
                  row.status === 'done'    ? 'text-success' :
                  row.status === 'error'   ? 'text-danger'  :
                  row.status === 'syncing' ? 'text-accent'  :
                  'text-slate-600'
                }`}>
                  {row.status === 'done' ? 'done' : row.status === 'error' ? 'error' : row.status === 'syncing' ? 'syncing…' : 'queued'}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
