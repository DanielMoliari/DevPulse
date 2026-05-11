import { gql } from '@apollo/client'

export const TRACK_REPOSITORY = gql`
  mutation TrackRepository($githubRepoId: String!) {
    trackRepository(githubRepoId: $githubRepoId) {
      id
      fullName
      isTracked
      syncState
    }
  }
`

export const UNTRACK_REPOSITORY = gql`
  mutation UntrackRepository($id: ID!) {
    untrackRepository(id: $id)
  }
`

export const SYNC_REPOSITORY = gql`
  mutation SyncRepository($id: ID!) {
    syncRepository(id: $id) {
      repositoryId
      queued
    }
  }
`

export const UPDATE_PROFILE = gql`
  mutation UpdateProfile($input: UpdateProfileInput!) {
    updateProfile(input: $input) {
      id
      name
      email
      avatarUrl
    }
  }
`

export const UPDATE_NOTIFICATION_PREFS = gql`
  mutation UpdateNotificationPrefs($input: UpdateNotificationPrefsInput!) {
    updateNotificationPrefs(input: $input) {
      id
      notificationsEnabled
      streakAlertsEnabled
    }
  }
`

export const UPDATE_PUBLIC_PROFILE_PREFS = gql`
  mutation UpdatePublicProfilePrefs($input: UpdatePublicProfilePrefsInput!) {
    updatePublicProfilePrefs(input: $input) {
      id
      publicShowRepos
      publicShowStreak
    }
  }
`

export const DELETE_ACCOUNT = gql`
  mutation DeleteAccount {
    deleteAccount
  }
`

export const SEND_TEST_DIGEST = gql`
  mutation SendTestDigest {
    sendTestDigest
  }
`

export const IMPORT_GITHUB_REPOSITORIES = gql`
  mutation ImportGitHubRepositories {
    importFromGitHub {
      imported
      tracked
    }
  }
`

export const CREATE_CHECKOUT_SESSION = gql`
  mutation CreateCheckoutSession($plan: String!, $interval: String!) {
    createCheckoutSession(plan: $plan, interval: $interval) {
      url
    }
  }
`

export const CREATE_PORTAL_SESSION = gql`
  mutation CreatePortalSession {
    createPortalSession {
      url
    }
  }
`

export const UPDATE_AUTO_SYNC_PREFS = gql`
  mutation UpdateAutoSyncPrefs($input: UpdateAutoSyncPrefsInput!) {
    updateAutoSyncPrefs(input: $input) {
      id
      autoSyncEnabled
      autoSyncIntervalHours
    }
  }
`

export const USE_STREAK_FREEZE = gql`
  mutation UseStreakFreeze {
    useStreakFreeze {
      currentStreak
      longestStreak
      lastActiveDate
      freezesUsed
    }
  }
`
