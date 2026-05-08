import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client'
import { CombinedGraphQLErrors } from '@apollo/client/errors'
import { setContext } from '@apollo/client/link/context'
import { onError } from '@apollo/client/link/error'
import { getToken } from './auth'

// In dev, attach the client to globalThis so Fast Refresh doesn't create a
// new instance (with a fresh empty cache) on every hot reload — which would
// cause every query to start from scratch and show skeletons indefinitely.
declare const globalThis: typeof global & { __apolloClient?: ApolloClient }
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
      watchQuery: { fetchPolicy: 'cache-and-network' },
      query: { fetchPolicy: 'cache-first' },
    },
  })
}

export function getApolloClient() {
  if (process.env.NODE_ENV === 'development') {
    if (!globalThis.__apolloClient) globalThis.__apolloClient = buildClient()
    return globalThis.__apolloClient
  }
  if (!_client) _client = buildClient()
  return _client
}
