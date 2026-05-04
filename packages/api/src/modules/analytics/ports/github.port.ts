export interface CommitActivityDto {
  date: Date
  count: number
  additions: number
  deletions: number
}

export interface PullRequestDto {
  number: number
  title: string
  state: 'open' | 'closed' | 'merged'
  createdAt: Date
  mergedAt: Date | null
  filesChanged: number
  additions: number
  deletions: number
}

export interface FileChurnDto {
  path: string
  commits: number
  additions: number
  deletions: number
}

export interface FileOwnershipDto {
  ownedFiles: number
  totalFiles: number
  ownershipPercent: number
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

export interface RepoInsightDto {
  description: string | null
  homepage: string | null
  defaultBranch: string
  stars: number
  forks: number
  watchers: number
  openIssues: number
  sizeKb: number
  createdAt: Date
  pushedAt: Date | null
  topics: string[]
  license: string | null
  // language byte counts straight from GitHub /repos/{owner}/{repo}/languages
  languages: Record<string, number>
}

export interface IGitHubPort {
  getUserRepositories(accessToken: string): Promise<GitHubRepoDto[]>
  getRepositoryInsights(accessToken: string, owner: string, repo: string): Promise<RepoInsightDto>
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
  // 24-element array (UTC hour 0-23) → commit count for the user on the default branch since `since`
  getCommitHours(
    accessToken: string,
    owner: string,
    repo: string,
    since: Date,
  ): Promise<number[]>
  getFileChurn(
    accessToken: string,
    owner: string,
    repo: string,
    since: Date,
  ): Promise<FileChurnDto[]>
  getAuthenticatedUserLogin(accessToken: string): Promise<string>
  getFileOwnership(
    accessToken: string,
    owner: string,
    repo: string,
    userLogin: string,
  ): Promise<FileOwnershipDto>
  getRateLimitStatus(accessToken: string): Promise<{ remaining: number; resetAt: Date }>
  getDependencyManifest(
    accessToken: string,
    owner: string,
    repo: string,
  ): Promise<{ deps: string[]; devDeps: string[]; ecosystem: string } | null>
}

export const GITHUB_PORT = Symbol('IGitHubPort')
