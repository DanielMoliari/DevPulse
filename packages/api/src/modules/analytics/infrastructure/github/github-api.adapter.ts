import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { Octokit } from '@octokit/rest'
import { throttling } from '@octokit/plugin-throttling'
import { retry } from '@octokit/plugin-retry'
import type {
  CommitActivityDto,
  FileChurnDto,
  FileOwnershipDto,
  GitHubRepoDto,
  IGitHubPort,
  PullRequestDto,
  RepoInsightDto,
  ReviewDto,
} from '../../ports/github.port'

const ThrottledOctokit = Octokit.plugin(throttling, retry)

@Injectable()
export class GitHubApiAdapter implements IGitHubPort {
  private readonly logger = new Logger(GitHubApiAdapter.name)

  private buildClient(accessToken: string): InstanceType<typeof ThrottledOctokit> {
    return new ThrottledOctokit({
      auth: accessToken,
      throttle: {
        onRateLimit: (retryAfter: number, options: Record<string, unknown>, _octokit: unknown, retryCount: number) => {
          this.logger.warn(`Rate limit hit, retryAfter=${retryAfter}s, attempt=${retryCount}`)
          return retryCount < 2
        },
        onSecondaryRateLimit: (_retryAfter: number, options: Record<string, unknown>) => {
          this.logger.warn(`Secondary rate limit for ${String(options['method'])} ${String(options['url'])}`)
          return false
        },
      },
      retry: { doNotRetry: ['429'] },
    })
  }

  async getUserRepositories(accessToken: string): Promise<GitHubRepoDto[]> {
    const octokit = this.buildClient(accessToken)
    const repos = await octokit.paginate(octokit.repos.listForAuthenticatedUser, {
      visibility: 'all',
      affiliation: 'owner',
      per_page: 100,
      sort: 'pushed',
    })
    return repos.map((r) => ({
      id: r.id,
      fullName: r.full_name,
      language: r.language ?? null,
      private: r.private,
      pushedAt: r.pushed_at ? new Date(r.pushed_at) : null,
    }))
  }

  async getRepositoryInsights(accessToken: string, owner: string, repo: string): Promise<RepoInsightDto> {
    const octokit = this.buildClient(accessToken)
    // /repos/{owner}/{repo} returns metadata, /languages returns byte counts per language
    const [meta, langs] = await Promise.all([
      octokit.repos.get({ owner, repo }),
      octokit.repos.listLanguages({ owner, repo }),
    ])
    const r = meta.data
    return {
      description: r.description ?? null,
      homepage: r.homepage ?? null,
      defaultBranch: r.default_branch,
      stars: r.stargazers_count,
      forks: r.forks_count,
      watchers: r.subscribers_count ?? r.watchers_count,
      openIssues: r.open_issues_count,
      sizeKb: r.size,
      createdAt: new Date(r.created_at),
      pushedAt: r.pushed_at ? new Date(r.pushed_at) : null,
      topics: r.topics ?? [],
      license: r.license?.spdx_id ?? r.license?.name ?? null,
      languages: langs.data as Record<string, number>,
    }
  }

  async getCommitActivity(
    accessToken: string,
    owner: string,
    repo: string,
    since: Date,
  ): Promise<CommitActivityDto[]> {
    const octokit = this.buildClient(accessToken)
    // GraphQL v4 returns 100 commits with their additions/deletions in ONE request.
    // REST listCommits omits stats — we'd need 1 extra request per commit (massive N+1).
    const query = `query($owner:String!, $name:String!, $since:GitTimestamp!, $cursor:String) {
      repository(owner: $owner, name: $name) {
        defaultBranchRef {
          target {
            ... on Commit {
              history(first: 100, since: $since, after: $cursor) {
                nodes { committedDate additions deletions }
                pageInfo { hasNextPage endCursor }
              }
            }
          }
        }
      }
    }`

    type Node = { committedDate: string; additions: number; deletions: number }
    type Page = {
      repository: {
        defaultBranchRef: {
          target: {
            history: { nodes: Node[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } }
          } | null
        } | null
      } | null
    }

    const all: Node[] = []
    let cursor: string | null = null
    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const res: Page = await octokit.graphql(query, {
          owner, name: repo, since: since.toISOString(), cursor,
        })
        const history = res.repository?.defaultBranchRef?.target?.history
        if (!history) break
        all.push(...history.nodes)
        if (!history.pageInfo.hasNextPage) break
        cursor = history.pageInfo.endCursor
      }
    } catch (err) {
      this.logger.warn(`GraphQL commits failed for ${owner}/${repo}: ${String(err)}`)
      return []
    }

    const byDay = new Map<string, CommitActivityDto>()
    for (const c of all) {
      const key = new Date(c.committedDate).toISOString().slice(0, 10)
      const existing = byDay.get(key)
      if (existing) {
        existing.count++
        existing.additions += c.additions
        existing.deletions += c.deletions
      } else {
        byDay.set(key, {
          date: new Date(key),
          count: 1,
          additions: c.additions,
          deletions: c.deletions,
        })
      }
    }
    return Array.from(byDay.values())
  }

  async getPullRequests(
    accessToken: string,
    owner: string,
    repo: string,
    since: Date,
  ): Promise<PullRequestDto[]> {
    const octokit = this.buildClient(accessToken)
    try {
      // List the 20 most recently updated PRs — fetching detail per PR is one extra call each,
      // so we cap here to avoid burning too much rate limit budget.
      const list = await octokit.pulls.list({
        owner, repo, state: 'all', per_page: 20, sort: 'updated', direction: 'desc',
      })
      const recent = list.data.filter((pr) => new Date(pr.created_at) >= since)

      // Fetch individual PR detail (includes changed_files, additions, deletions, title)
      const details = await Promise.all(
        recent.map((pr) => octokit.pulls.get({ owner, repo, pull_number: pr.number })),
      )
      return details.map((res) => {
        const pr = res.data
        return {
          number: pr.number,
          title: pr.title,
          state: pr.merged_at ? 'merged' : (pr.state as 'open' | 'closed'),
          createdAt: new Date(pr.created_at),
          mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
          filesChanged: pr.changed_files,
          additions: pr.additions,
          deletions: pr.deletions,
        }
      })
    } catch {
      return []
    }
  }

  async getReviews(
    accessToken: string,
    owner: string,
    repo: string,
    since: Date,
  ): Promise<ReviewDto[]> {
    const octokit = this.buildClient(accessToken)
    try {
      const prs = await octokit.paginate(octokit.pulls.list, {
        owner, repo, state: 'all', per_page: 50,
      })

      const reviews: ReviewDto[] = []
      // cap at 20 PRs — fetching reviews is a separate request per PR, gets expensive fast
      for (const pr of prs.slice(0, 20)) {
        const prReviews = await octokit.pulls.listReviews({ owner, repo, pull_number: pr.number })
        for (const review of prReviews.data) {
          if (review.submitted_at && new Date(review.submitted_at) >= since) {
            reviews.push({ pullNumber: pr.number, submittedAt: new Date(review.submitted_at) })
          }
        }
      }
      return reviews
    } catch {
      return []
    }
  }

  async getCommitHours(
    accessToken: string,
    owner: string,
    repo: string,
    since: Date,
  ): Promise<number[]> {
    const octokit = this.buildClient(accessToken)
    // GraphQL gives us committedDate per commit, which we bucket by UTC hour.
    // Reusing the same paginated history pattern as getCommitActivity but only pulling timestamps.
    const query = `query($owner:String!, $name:String!, $since:GitTimestamp!, $cursor:String) {
      repository(owner: $owner, name: $name) {
        defaultBranchRef {
          target {
            ... on Commit {
              history(first: 100, since: $since, after: $cursor) {
                nodes { committedDate }
                pageInfo { hasNextPage endCursor }
              }
            }
          }
        }
      }
    }`

    type Node = { committedDate: string }
    type Page = {
      repository: {
        defaultBranchRef: {
          target: {
            history: { nodes: Node[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } }
          } | null
        } | null
      } | null
    }

    const hours = new Array(24).fill(0) as number[]
    let cursor: string | null = null
    try {
      // Cap at ~10 pages (1000 commits) per repo to keep cold loads bounded
      let pages = 0
      // eslint-disable-next-line no-constant-condition
      while (pages < 10) {
        const res: Page = await octokit.graphql(query, {
          owner, name: repo, since: since.toISOString(), cursor,
        })
        const history = res.repository?.defaultBranchRef?.target?.history
        if (!history) break
        for (const c of history.nodes) {
          const h = new Date(c.committedDate).getUTCHours()
          if (h >= 0 && h < 24) hours[h]!++
        }
        if (!history.pageInfo.hasNextPage) break
        cursor = history.pageInfo.endCursor
        pages++
      }
    } catch (err) {
      this.logger.warn(`GraphQL commit hours failed for ${owner}/${repo}: ${String(err)}`)
      return hours
    }
    return hours
  }

  async getFileChurn(
    accessToken: string,
    owner: string,
    repo: string,
    since: Date,
  ): Promise<FileChurnDto[]> {
    const octokit = this.buildClient(accessToken)
    try {
      const { data: commits } = await octokit.repos.listCommits({
        owner, repo, since: since.toISOString(), per_page: 30,
      })
      const fileMap = new Map<string, { commits: number; additions: number; deletions: number }>()
      await Promise.all(commits.map(async (c) => {
        try {
          const { data: detail } = await octokit.repos.getCommit({ owner, repo, ref: c.sha })
          for (const f of detail.files ?? []) {
            const existing = fileMap.get(f.filename)
            if (existing) {
              existing.commits++
              existing.additions += f.additions ?? 0
              existing.deletions += f.deletions ?? 0
            } else {
              fileMap.set(f.filename, { commits: 1, additions: f.additions ?? 0, deletions: f.deletions ?? 0 })
            }
          }
        } catch (err) {
          this.logger.warn(`getFileChurn: failed to fetch commit ${c.sha}: ${String(err)}`)
        }
      }))
      return [...fileMap.entries()]
        .map(([path, stats]) => ({ path, ...stats }))
        .sort((a, b) => b.commits - a.commits)
        .slice(0, 20)
    } catch (err) {
      this.logger.warn(`getFileChurn failed for ${owner}/${repo}: ${String(err)}`)
      return []
    }
  }

  async getAuthenticatedUserLogin(accessToken: string): Promise<string> {
    const { data } = await this.buildClient(accessToken).users.getAuthenticated()
    return data.login
  }

  async getFileOwnership(
    accessToken: string,
    owner: string,
    repo: string,
    userLogin: string,
  ): Promise<FileOwnershipDto> {
    const octokit = this.buildClient(accessToken)
    let tree: { path?: string; type?: string }[] = []
    try {
      const { data } = await octokit.git.getTree({ owner, repo, tree_sha: 'HEAD', recursive: '1' })
      tree = data.tree
    } catch {
      return { ownedFiles: 0, totalFiles: 0, ownershipPercent: 0 }
    }
    const codeFiles = tree
      .filter((f) => f.type === 'blob' && f.path)
      .filter((f) => !/(node_modules|\.git|dist|build|vendor|__pycache__)/.test(f.path!))
      .slice(0, 30)
    const totalFiles = codeFiles.length
    if (totalFiles === 0) return { ownedFiles: 0, totalFiles: 0, ownershipPercent: 0 }
    let ownedFiles = 0
    const CHUNK = 8
    for (let i = 0; i < codeFiles.length; i += CHUNK) {
      const chunk = codeFiles.slice(i, i + CHUNK)
      await Promise.all(chunk.map(async (f) => {
        try {
          const { data: commits } = await octokit.repos.listCommits({
            owner, repo, path: f.path!, per_page: 5,
          })
          const userCommits = commits.filter((c) => c.author?.login === userLogin).length
          if (userCommits >= 2 || (commits.length > 0 && userCommits / commits.length >= 0.4)) {
            ownedFiles++
          }
        } catch { /* skip */ }
      }))
    }
    return {
      ownedFiles,
      totalFiles,
      ownershipPercent: totalFiles > 0 ? Math.round((ownedFiles / totalFiles) * 100) : 0,
    }
  }

  async getRateLimitStatus(accessToken: string): Promise<{ remaining: number; resetAt: Date }> {
    const octokit = this.buildClient(accessToken)
    try {
      const { data } = await octokit.rateLimit.get()
      return {
        remaining: data.rate.remaining,
        resetAt: new Date(data.rate.reset * 1000),
      }
    } catch {
      throw new ServiceUnavailableException('Could not reach GitHub API')
    }
  }

  async getDependencyManifest(
    accessToken: string,
    owner: string,
    repo: string,
  ): Promise<{ deps: string[]; devDeps: string[]; ecosystem: string } | null> {
    const octokit = this.buildClient(accessToken)

    const tryFetch = async (path: string): Promise<string | null> => {
      try {
        const { data } = await octokit.repos.getContent({ owner, repo, path })
        if ('content' in data && typeof data.content === 'string') {
          return Buffer.from(data.content, 'base64').toString('utf-8')
        }
      } catch { /* 404 → null */ }
      return null
    }

    // package.json — npm
    const pkgJson = await tryFetch('package.json')
    if (pkgJson) {
      try {
        const parsed = JSON.parse(pkgJson) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
        const deps = Object.keys(parsed.dependencies ?? {})
        const devDeps = Object.keys(parsed.devDependencies ?? {})
        return { deps, devDeps, ecosystem: 'npm' }
      } catch { /* malformed */ }
    }

    // requirements.txt — python
    const reqTxt = await tryFetch('requirements.txt')
    if (reqTxt) {
      const deps = reqTxt.split('\n')
        .map((l) => l.split(/[=><!\[;]/)[0]?.trim() ?? '')
        .filter((l) => l && !l.startsWith('#'))
      return { deps, devDeps: [], ecosystem: 'python' }
    }

    // go.mod — go
    const goMod = await tryFetch('go.mod')
    if (goMod) {
      const deps = goMod.split('\n')
        .filter((l) => l.trim().startsWith('require') || (l.startsWith('\t') && !l.includes('//')))
        .map((l) => l.trim().split(/\s+/)[0] ?? '')
        .filter((l) => l && l !== 'require' && l !== ')')
      return { deps, devDeps: [], ecosystem: 'go' }
    }

    // Cargo.toml — rust
    const cargoToml = await tryFetch('Cargo.toml')
    if (cargoToml) {
      const lines = cargoToml.split('\n')
      let inDeps = false
      const deps: string[] = []
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed === '[dependencies]') { inDeps = true; continue }
        if (trimmed.startsWith('[') && trimmed !== '[dependencies]') { inDeps = false; continue }
        if (inDeps && trimmed && !trimmed.startsWith('#')) {
          const key = trimmed.split('=')[0]?.trim()
          if (key) deps.push(key)
        }
      }
      if (deps.length > 0) return { deps, devDeps: [], ecosystem: 'rust' }
    }

    // composer.json — php
    const composerJson = await tryFetch('composer.json')
    if (composerJson) {
      try {
        const parsed = JSON.parse(composerJson) as { require?: Record<string, string>; 'require-dev'?: Record<string, string> }
        const deps = Object.keys(parsed.require ?? {}).filter((k) => k !== 'php')
        const devDeps = Object.keys(parsed['require-dev'] ?? {})
        if (deps.length > 0 || devDeps.length > 0) return { deps, devDeps, ecosystem: 'php' }
      } catch { /* malformed */ }
    }

    return null
  }

}