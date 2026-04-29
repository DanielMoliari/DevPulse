'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@apollo/client/react'
import { Search, Plus } from 'lucide-react'
import { RepoCard, RepoCardSkeleton } from '@/components/repo-card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { REPOSITORIES_QUERY } from '@/graphql/queries'
import { TRACK_REPOSITORY, UNTRACK_REPOSITORY, SYNC_REPOSITORY } from '@/graphql/mutations'
import type { Repository } from '@/graphql/types'

export default function ReposPage() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'tracked' | 'untracked'>('all')

  const { data, loading } = useQuery<{ repositories: Repository[] }>(REPOSITORIES_QUERY)
  const [trackRepo, { loading: tracking }] = useMutation(TRACK_REPOSITORY, {
    refetchQueries: [REPOSITORIES_QUERY],
  })
  const [untrackRepo] = useMutation(UNTRACK_REPOSITORY, {
    refetchQueries: [REPOSITORIES_QUERY],
  })
  const [syncRepo, { loading: syncing }] = useMutation(SYNC_REPOSITORY)
  const [currentSyncId, setCurrentSyncId] = useState<string | null>(null)

  function handleToggle(id: string, tracked: boolean) {
    if (tracked) {
      void trackRepo({ variables: { githubRepoId: id } })
    } else {
      void untrackRepo({ variables: { id } })
    }
  }

  function handleSync(id: string) {
    setCurrentSyncId(id)
    void syncRepo({ variables: { id } }).finally(() => setCurrentSyncId(null))
  }

  const repos = data?.repositories ?? []
  const tracked = repos.filter((r) => r.isTracked).length

  const filtered = repos.filter((r) => {
    const matchSearch = r.fullName.toLowerCase().includes(search.toLowerCase())
    const matchFilter =
      filter === 'all' || (filter === 'tracked' ? r.isTracked : !r.isTracked)
    return matchSearch && matchFilter
  })

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-slate-100">Repositories</h2>
          <Badge variant="default">{tracked} tracked</Badge>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
          <Input
            className="pl-8"
            placeholder="Search repositories…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          {(['all', 'tracked', 'untracked'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors capitalize ${
                filter === f ? 'bg-surface-2 text-slate-100' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <RepoCardSkeleton key={i} />)
          : filtered.length === 0
            ? (
              <div className="py-16 text-center text-sm text-slate-600">
                {search ? `No repositories matching "${search}"` : 'No repositories found'}
              </div>
            )
            : filtered.map((repo) => (
              <RepoCard
                key={repo.id}
                repo={repo}
                onToggleTrack={handleToggle}
                onSync={handleSync}
                syncing={syncing && currentSyncId === repo.id}
              />
            ))}
      </div>
    </div>
  )
}
