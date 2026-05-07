'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Circle, AlertCircle, RefreshCw, X, ChevronDown, ChevronUp } from 'lucide-react'
import { useMutation, useQuery } from '@apollo/client/react'
import { REPOSITORIES_QUERY } from '@/graphql/queries'
import { SYNC_REPOSITORY } from '@/graphql/mutations'
import type { Repository } from '@/graphql/types'

interface SyncPanelProps {
  open: boolean
  onClose: () => void
}

type RepoSyncStatus = 'queued' | 'syncing' | 'done' | 'error' | 'idle'

interface RepoRow {
  id: string
  fullName: string
  status: RepoSyncStatus
}

function StatusIcon({ status }: { status: RepoSyncStatus }) {
  if (status === 'done')
    return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
  if (status === 'error')
    return <AlertCircle className="h-3.5 w-3.5 shrink-0 text-danger" />
  if (status === 'syncing')
    return <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin text-accent" />
  if (status === 'queued')
    return <Circle className="h-3.5 w-3.5 shrink-0 text-slate-600" />
  return <Circle className="h-3.5 w-3.5 shrink-0 text-slate-700" />
}

function StatusLabel({ status }: { status: RepoSyncStatus }) {
  const map: Record<RepoSyncStatus, { text: string; cls: string }> = {
    idle:    { text: 'up to date', cls: 'text-slate-600' },
    queued:  { text: 'queued',     cls: 'text-slate-500' },
    syncing: { text: 'syncing…',   cls: 'text-accent' },
    done:    { text: 'done',       cls: 'text-success' },
    error:   { text: 'error',      cls: 'text-danger' },
  }
  const { text, cls } = map[status]
  return <span className={`text-xs tabular ${cls}`}>{text}</span>
}

export function SyncPanel({ open, onClose }: SyncPanelProps) {
  const { data, refetch } = useQuery<{ repositories: Repository[] }>(REPOSITORIES_QUERY, { fetchPolicy: 'network-only' })
  const [syncRepository] = useMutation(SYNC_REPOSITORY)

  const [rows, setRows] = useState<RepoRow[]>([])
  const [started, setStarted] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedRef = useRef(false)

  const tracked = (data?.repositories ?? []).filter((r) => r.isTracked)

  // Initialise rows from repo list when panel opens
  useEffect(() => {
    if (!open) return
    const repos = (data?.repositories ?? []).filter((r) => r.isTracked)
    setRows(
      repos.map((r) => ({
        id: r.id,
        fullName: r.fullName,
        status: r.syncState === 'SYNCING' ? 'syncing' : 'queued',
      }))
    )
    setStarted(false)
    startedRef.current = false
    setCollapsed(false)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Kick off sync once rows are initialised
  useEffect(() => {
    if (!open || rows.length === 0 || startedRef.current) return
    startedRef.current = true
    setStarted(true)
    void triggerAll()
  }, [open, rows.length]) // eslint-disable-line react-hooks/exhaustive-deps

  async function triggerAll() {
    const repos = ((await refetch()).data?.repositories ?? []).filter((r) => r.isTracked)

    // Fire all sync mutations — BullMQ will de-dupe jobs with the same jobId
    await Promise.allSettled(
      repos.map((r) => syncRepository({ variables: { id: r.id } }))
    )

    // Poll every 1.5s and update each row's status from fresh query data
    pollRef.current = setInterval(async () => {
      const result = await refetch()
      const fresh = result.data?.repositories ?? []

      setRows((prev) =>
        prev.map((row) => {
          const live = fresh.find((r) => r.id === row.id)
          if (!live) return row
          if (live.syncState === 'SYNCING') return { ...row, status: 'syncing' }
          if (live.syncState === 'ERROR')   return { ...row, status: 'error' }
          // IDLE after we started = done
          if (row.status === 'syncing' || row.status === 'queued') return { ...row, status: 'done' }
          return row
        })
      )

      const stillRunning = fresh.some((r) => r.isTracked && r.syncState === 'SYNCING')
      if (!stillRunning) {
        clearInterval(pollRef.current!)
        pollRef.current = null
        // Mark any remaining queued as done
        setRows((prev) =>
          prev.map((r) => (r.status === 'queued' || r.status === 'syncing' ? { ...r, status: 'done' } : r))
        )
      }
    }, 1500)
  }

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  if (!open) return null

  const done  = rows.filter((r) => r.status === 'done').length
  const total = rows.length
  const allDone = done === total && total > 0
  const progress = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-xl border border-border-2 bg-surface shadow-2xl shadow-black/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <RefreshCw
            className={[
              'h-3.5 w-3.5 shrink-0',
              allDone ? 'text-success' : 'animate-spin text-accent',
            ].join(' ')}
          />
          <span className="text-sm font-medium text-slate-200 truncate">
            {allDone ? 'All synced' : `Syncing repositories`}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="rounded p-1 text-slate-500 hover:bg-surface-2 hover:text-slate-300 transition-colors cursor-pointer"
          >
            {collapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:bg-surface-2 hover:text-slate-300 transition-colors cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 w-full bg-surface-2">
        <div
          className="h-full bg-accent transition-all duration-500"
          style={{ width: `${progress}%`, ...(allDone ? { backgroundColor: 'var(--color-success)' } : {}) }}
        />
      </div>

      {/* Summary line */}
      {!collapsed && (
        <div className="px-4 py-2 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {allDone ? `${total} repositories up to date` : `${done} / ${total} complete`}
          </span>
          <span className="text-xs font-semibold tabular text-slate-400">{progress}%</span>
        </div>
      )}

      {/* Repo list */}
      {!collapsed && (
        <ul className="max-h-64 overflow-y-auto px-2 pb-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <StatusIcon status={row.status} />
                <span className="text-xs text-slate-300 truncate">{row.fullName}</span>
              </div>
              <StatusLabel status={row.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
