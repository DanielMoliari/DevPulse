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
