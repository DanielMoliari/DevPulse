import { gql } from '@apollo/client'

export const ME_QUERY = gql`
  query Me {
    me {
      id
      githubId
      username
      name
      email
      avatarUrl
      plan
      notificationsEnabled
      streakAlertsEnabled
      publicProfile
      publicShowRepos
      publicShowStreak
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
    }
  }
`

export const HEATMAP_QUERY = gql`
  query Heatmap($year: Int) {
    heatmap(year: $year) {
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

export const REPOSITORY_DETAIL_QUERY = gql`
  query RepositoryDetail($id: ID!) {
    repositoryDetail(id: $id) {
      repository { id fullName language isTracked syncState lastSyncedAt }
      description homepage defaultBranch
      stars forks watchers openIssues sizeKb
      createdAt pushedAt
      topics license
      totalBytes
      languages { name bytes percent }
      recentMetrics { id date commits additions deletions prsMerged netLines churnRatio }
      curiosities { label value }
    }
  }
`
