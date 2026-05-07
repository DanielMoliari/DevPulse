import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client'
import { CombinedGraphQLErrors } from '@apollo/client/errors'
import { setContext } from '@apollo/client/link/context'
import { onError } from '@apollo/client/link/error'
import { getToken } from './auth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: ApolloClient | null = null

function buildClient() {
  const httpLink = createHttpLink({
    uri: `${process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:17642'}/api/graphql`,
  })

  // v4 legacy setter: (operation, prevContext) => updatedContext
  const authLink = setContext((_op, prevContext) => {
    const token = getToken()
    const prev = prevContext as { headers?: Record<string, string> }
    return {
      headers: {
        ...(prev.headers ?? {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    }
  })

  const errorLink = onError(({ error }) => {
    const isUnauthenticated = CombinedGraphQLErrors.is(error)
      ? error.errors.some(
          (e) => e.extensions?.['code'] === 'UNAUTHENTICATED' || e.message === 'Unauthorized',
        )
      : error?.message?.includes('UNAUTHENTICATED') || error?.message?.includes('Unauthorized')
    if (typeof window !== 'undefined' && isUnauthenticated) {
      window.location.href = '/'
    }
  })

  return new ApolloClient({
    link: from([errorLink, authLink, httpLink]),
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: { fetchPolicy: 'network-only' },
      query: { fetchPolicy: 'network-only' },
    },
  })
}

export function getApolloClient() {
  if (!_client) _client = buildClient()
  return _client
}
