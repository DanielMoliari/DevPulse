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
