import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { Octokit } from '@octokit/rest'
import { throttling } from '@octokit/plugin-throttling'
import { retry } from '@octokit/plugin-retry'
import type {
  CommitActivityDto,
  GitHubRepoDto,
  IGitHubPort,
  PullRequestDto,
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
    }))
  }

  async getCommitActivity(
    accessToken: string,
    owner: string,
    repo: string,
    since: Date,
  ): Promise<CommitActivityDto[]> {
    const octokit = this.buildClient(accessToken)
    try {
      const commits = await octokit.paginate(octokit.repos.listCommits, {
        owner,
        repo,
        since: since.toISOString(),
        per_page: 100,
      })

      const byDay = new Map<string, CommitActivityDto>()
      for (const commit of commits) {
        const date = new Date(commit.commit.author?.date ?? commit.commit.committer?.date ?? new Date())
        const key = date.toISOString().slice(0, 10)
        const existing = byDay.get(key)
        const stats = commit.stats
        if (existing) {
          existing.count++
          existing.additions += stats?.additions ?? 0
          existing.deletions += stats?.deletions ?? 0
        } else {
          byDay.set(key, {
            date: new Date(key),
            count: 1,
            additions: stats?.additions ?? 0,
            deletions: stats?.deletions ?? 0,
          })
        }
      }
      return Array.from(byDay.values())
    } catch (err: unknown) {
      this.logger.warn(`Failed to get commits for ${owner}/${repo}: ${String(err)}`)
      return []
    }
  }

  async getPullRequests(
    accessToken: string,
    owner: string,
    repo: string,
    since: Date,
  ): Promise<PullRequestDto[]> {
    const octokit = this.buildClient(accessToken)
    try {
      const prs = await octokit.paginate(octokit.pulls.list, {
        owner,
        repo,
        state: 'all',
        per_page: 100,
        sort: 'updated',
        direction: 'desc',
      })
      return prs
        .filter((pr) => new Date(pr.created_at) >= since)
        .map((pr) => ({
          number: pr.number,
          state: pr.merged_at ? 'merged' : (pr.state as 'open' | 'closed'),
          createdAt: new Date(pr.created_at),
          mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
        }))
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
}
