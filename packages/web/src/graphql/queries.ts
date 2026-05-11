import { gql } from '@apollo/client'

export const ME_QUERY = gql`
  query Me {
    me {
      id
      githubId
      githubUsername
      username
      name
      email
      avatarUrl
      plan
      notificationsEnabled
      streakAlertsEnabled
      publicShowRepos
      publicShowStreak
      autoSyncEnabled
      autoSyncIntervalHours
      subscriptionStatus
      currentPeriodEnd
      billingInterval
    }
  }
`

export const BILLING_STATUS_QUERY = gql`
  query BillingStatus {
    billingStatus {
      configured
      hasActiveSubscription
      subscriptionStatus
      currentPeriodEnd
      billingInterval
    }
  }
`

export const PUBLIC_PROFILE_QUERY = gql`
  query PublicProfile($username: String!) {
    publicProfile(username: $username) {
      username
      displayName
      avatarUrl
      joinedAt
      activeDays
      totalCommits
      totalAdditions
      totalPrs
      avgCommitsPerActiveDay
      currentStreak
      longestStreak
      topLanguages { name bytes percent }
      recentActivity { date count level }
      trackedRepos { fullName language }
    }
  }
`

export const REPOSITORIES_QUERY = gql`
  query Repositories {
    repositories {
      id
      fullName
      language
      isTracked
      syncState
      lastSyncedAt
      commitCount
      linesAdded
      pushedAt
    }
  }
`

export const METRICS_QUERY = gql`
  query Metrics($from: DateTime!, $to: DateTime!) {
    metrics(input: { from: $from, to: $to }) {
      id
      date
      commits
      additions
      deletions
      prsOpened
      prsMerged
      reviewsDone
      netLines
      churnRatio
    }
  }
`

export const STREAK_QUERY = gql`
  query Streak {
    streak {
      currentStreak
      longestStreak
      lastActiveDate
      freezesUsed
    }
  }
`

export const HEATMAP_QUERY = gql`
  query Heatmap($year: Int, $metric: HeatmapMetric) {
    heatmap(year: $year, metric: $metric) {
      date
      count
      level
    }
  }
`

export const TECH_GRAPH_QUERY = gql`
  query TechGraph {
    techGraph {
      nodes { id type name value }
      links { source target value }
    }
  }
`

export const LANGUAGE_HISTORY_QUERY = gql`
  query LanguageHistory {
    languageHistory {
      years
      series { language values }
    }
  }
`

export const INSIGHTS_QUERY = gql`
  query Insights {
    insights {
      burnout { atRisk consecutiveDays netLinesTrend message }
      techGraduations { from to year confidence message }
    }
  }
`

export const HOURLY_ACTIVITY_QUERY = gql`
  query HourlyActivity {
    hourlyActivity { hours peakHour peakRatio }
  }
`

export const PERSONAL_RECORDS_QUERY = gql`
  query PersonalRecords {
    personalRecords {
      hasNewRecord
      commits { today allTimeBest isRecord }
      additions { today allTimeBest isRecord }
      netLines { today allTimeBest isRecord }
    }
  }
`

export const SEARCH_PROFILE_QUERY = gql`
  query SearchProfile($query: String!) {
    searchProfile(query: $query) {
      source
      username
      displayName
      avatarUrl
      bio
      location
      followers
      publicRepos
      totalCommits
      currentStreak
      topLanguages { name percent }
    }
  }
`

export const SEARCH_REPO_QUERY = gql`
  query SearchRepo($owner: String!, $repo: String!) {
    searchRepo(owner: $owner, repo: $repo) {
      fullName
      description
      primaryLanguage
      stars
      forks
      openIssues
      sizeKb
      totalFiles
      createdAt
      pushedAt
      homepage
      topics
      languages { name bytes percent }
      contributors { login avatarUrl contributions }
      weeklyCommits { week total }
      punchCard { day hour count }
      fileExtensions { ext count }
    }
  }
`

export const PLATFORM_STATS_QUERY = gql`
  query PlatformStats {
    platformStats {
      userCount
      commitCount
    }
  }
`

export const REPOSITORY_DETAIL_QUERY = gql`
  query RepositoryDetail($id: ID!) {
    repositoryDetail(id: $id) {
      repository { id fullName language isTracked isPrivate syncState lastSyncedAt }
      description homepage defaultBranch
      stars forks watchers openIssues sizeKb
      createdAt pushedAt
      topics license
      totalBytes
      languages { name bytes percent }
      recentMetrics { id date commits additions deletions prsMerged netLines churnRatio }
      curiosities { label value }
      health { score grade breakdown { churn consistency mergeRate cadence } }
      prsDetail { number title state category createdAt mergedAt filesChanged additions deletions }
      fileOwnership { ownedFiles totalFiles ownershipPercent }
      fileHotspots { path commits additions deletions churnRatio }
      ecosystemConnections { repoFullName ecosystem sharedDeps sharedCount overlapScore }
    }
  }
`
