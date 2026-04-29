export interface CommitActivityDto {
  date: Date
  count: number
  additions: number
  deletions: number
}

export interface PullRequestDto {
  number: number
  state: 'open' | 'closed' | 'merged'
  createdAt: Date
  mergedAt: Date | null
}

export interface ReviewDto {
  pullNumber: number
  submittedAt: Date
}

export interface GitHubRepoDto {
  id: number
  fullName: string
  language: string | null
  private: boolean
}

export interface IGitHubPort {
  getUserRepositories(accessToken: string): Promise<GitHubRepoDto[]>
  getCommitActivity(
    accessToken: string,
    owner: string,
    repo: string,
    since: Date,
  ): Promise<CommitActivityDto[]>
  getPullRequests(
    accessToken: string,
    owner: string,
    repo: string,
    since: Date,
  ): Promise<PullRequestDto[]>
  getReviews(
    accessToken: string,
    owner: string,
    repo: string,
    since: Date,
  ): Promise<ReviewDto[]>
  getRateLimitStatus(accessToken: string): Promise<{ remaining: number; resetAt: Date }>
}

export const GITHUB_PORT = Symbol('IGitHubPort')
