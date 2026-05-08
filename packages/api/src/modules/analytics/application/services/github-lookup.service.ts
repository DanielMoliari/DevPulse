import { Injectable, Logger } from '@nestjs/common'
import { SearchRepoResultType } from '../../graphql/types/search-profile.type'

// Anonymous GitHub API — 60 req/h per IP. Good enough for a search bar.
// No token needed, no user data stored.

export interface GitHubUserData {
  login: string
  name: string | null
  avatarUrl: string
  bio: string | null
  company: string | null
  location: string | null
  blog: string | null
  followers: number
  following: number
  publicRepos: number
  createdAt: string
}

export interface GitHubRepoData {
  fullName: string
  description: string | null
  language: string | null
  stargazersCount: number
  forksCount: number
  isPrivate: boolean
}

export interface GitHubLookupResult {
  user: GitHubUserData
  topRepos: GitHubRepoData[]
  topLanguages: { name: string; percent: number }[]
}

@Injectable()
export class GitHubLookupService {
  private readonly logger = new Logger(GitHubLookupService.name)
  private readonly baseUrl = 'https://api.github.com'

  private async ghFetch<T>(path: string): Promise<T | null> {
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'DevPulse/1.0',
        },
      })
      if (!res.ok) return null
      return res.json() as Promise<T>
    } catch (err) {
      this.logger.warn(`GitHub API fetch failed: ${path} — ${String(err)}`)
      return null
    }
  }

  async lookup(username: string): Promise<GitHubLookupResult | null> {
    const normalized = username.trim().toLowerCase()

    // Fetch user + repos in parallel
    const [rawUser, rawRepos] = await Promise.all([
      this.ghFetch<Record<string, unknown>>(`/users/${normalized}`),
      this.ghFetch<Record<string, unknown>[]>(`/users/${normalized}/repos?per_page=30&sort=pushed&type=owner`),
    ])

    if (!rawUser || rawUser['message'] === 'Not Found') return null

    const topRepos: GitHubRepoData[] = (rawRepos ?? [])
      .filter((r) => !r['fork'])
      .sort((a, b) => (b['stargazers_count'] as number) - (a['stargazers_count'] as number))
      .slice(0, 12)
      .map((r) => ({
        fullName: String(r['full_name'] ?? ''),
        description: r['description'] ? String(r['description']) : null,
        language: r['language'] ? String(r['language']) : null,
        stargazersCount: Number(r['stargazers_count'] ?? 0),
        forksCount: Number(r['forks_count'] ?? 0),
        isPrivate: Boolean(r['private']),
      }))

    // Aggregate languages from repos by counting repos per language
    const langCount = new Map<string, number>()
    for (const r of rawRepos ?? []) {
      if (r['language']) {
        const l = String(r['language'])
        langCount.set(l, (langCount.get(l) ?? 0) + 1)
      }
    }
    const totalReposWithLang = [...langCount.values()].reduce((s, n) => s + n, 0)
    const topLanguages = [...langCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({
        name,
        percent: totalReposWithLang > 0 ? Math.round((count / totalReposWithLang) * 1000) / 10 : 0,
      }))

    return {
      user: {
        login: String(rawUser['login'] ?? normalized),
        name: rawUser['name'] ? String(rawUser['name']) : null,
        avatarUrl: String(rawUser['avatar_url'] ?? ''),
        bio: rawUser['bio'] ? String(rawUser['bio']) : null,
        company: rawUser['company'] ? String(rawUser['company']) : null,
        location: rawUser['location'] ? String(rawUser['location']) : null,
        blog: rawUser['blog'] ? String(rawUser['blog']) : null,
        followers: Number(rawUser['followers'] ?? 0),
        following: Number(rawUser['following'] ?? 0),
        publicRepos: Number(rawUser['public_repos'] ?? 0),
        createdAt: String(rawUser['created_at'] ?? ''),
      },
      topRepos,
      topLanguages,
    }
  }

  async lookupRepo(owner: string, repo: string): Promise<SearchRepoResultType | null> {
    const path = `/repos/${owner}/${repo}`

    const [rawRepo, rawLangs, rawContribs, rawActivity] = await Promise.all([
      this.ghFetch<Record<string, unknown>>(path),
      this.ghFetch<Record<string, number>>(`${path}/languages`),
      this.ghFetch<Record<string, unknown>[]>(`${path}/contributors?per_page=10`),
      this.ghFetch<{ week: number; total: number; days: number[] }[]>(`${path}/stats/commit_activity`),
    ])

    if (!rawRepo || rawRepo['message'] === 'Not Found') return null

    const totalBytes = Object.values(rawLangs ?? {}).reduce((s, b) => s + b, 0)
    const languages = Object.entries(rawLangs ?? {})
      .sort((a, b) => b[1] - a[1])
      .map(([name, bytes]) => ({
        name,
        bytes,
        percent: totalBytes > 0 ? Math.round((bytes / totalBytes) * 1000) / 10 : 0,
      }))

    const contributors = (rawContribs ?? []).slice(0, 8).map((c) => ({
      login: String(c['login'] ?? ''),
      ...(c['avatar_url'] ? { avatarUrl: String(c['avatar_url']) } : {}),
      contributions: Number(c['contributions'] ?? 0),
    }))

    // GitHub returns 202 while computing stats — rawActivity may be null or non-array
    const activityArr = Array.isArray(rawActivity) ? rawActivity : []
    const weeklyCommits = activityArr.slice(-52).map((w) => ({
      week: w.week,
      total: w.total,
    }))

    return {
      fullName: String(rawRepo['full_name'] ?? `${owner}/${repo}`),
      ...(rawRepo['description'] ? { description: String(rawRepo['description']) } : {}),
      ...(rawRepo['language'] ? { primaryLanguage: String(rawRepo['language']) } : {}),
      stars: Number(rawRepo['stargazers_count'] ?? 0),
      forks: Number(rawRepo['forks_count'] ?? 0),
      openIssues: Number(rawRepo['open_issues_count'] ?? 0),
      sizeKb: Number(rawRepo['size'] ?? 0),
      createdAt: String(rawRepo['created_at'] ?? ''),
      pushedAt: String(rawRepo['pushed_at'] ?? ''),
      ...(rawRepo['homepage'] ? { homepage: String(rawRepo['homepage']) } : {}),
      topics: Array.isArray(rawRepo['topics']) ? (rawRepo['topics'] as string[]) : [],
      languages,
      contributors,
      weeklyCommits,
    }
  }
}
