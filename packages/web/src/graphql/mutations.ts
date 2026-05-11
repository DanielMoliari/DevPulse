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

export const CREATE_TEAM = gql`
  mutation CreateTeam($input: CreateTeamInput!) {
    createTeam(input: $input) {
      id name slug ownerId createdAt
    }
  }
`

export const INVITE_TO_TEAM = gql`
  mutation InviteToTeam($input: InviteMemberInput!) {
    inviteToTeam(input: $input) {
      id email role expiresAt
    }
  }
`

export const REMOVE_TEAM_MEMBER = gql`
  mutation RemoveTeamMember($teamId: ID!, $userId: ID!) {
    removeTeamMember(teamId: $teamId, userId: $userId)
  }
`

export const UPDATE_TEAM_MEMBER_ROLE = gql`
  mutation UpdateTeamMemberRole($input: UpdateMemberRoleInput!) {
    updateTeamMemberRole(input: $input) {
      id userId role
    }
  }
`

export const DELETE_TEAM = gql`
  mutation DeleteTeam($teamId: ID!) {
    deleteTeam(teamId: $teamId)
  }
`

export const ACCEPT_TEAM_INVITE = gql`
  mutation AcceptTeamInvite($token: String!) {
    acceptTeamInvite(token: $token) {
      id name slug
    }
  }
`

export const JOIN_WAITLIST = gql`
  mutation JoinWaitlist($input: JoinWaitlistInput!) {
    joinWaitlist(input: $input) {
      id email createdAt
    }
  }
`
