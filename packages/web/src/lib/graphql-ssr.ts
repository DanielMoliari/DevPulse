// Tiny server-side GraphQL fetcher for use in Next.js Server Components and
// `generateMetadata`. The Apollo client in `apollo-client.ts` is tied to
// `localStorage` and only runs on the client; this helper does plain `fetch`
// against the API — which is the right shape for public, anonymous queries.

interface GraphQLResponse<T> {
  data?: T
  errors?: { message: string }[]
}

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:17642'

export async function ssrGraphQL<T>(
  query: string,
  variables: Record<string, unknown>,
  options: { revalidate?: number } = {},
): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}/api/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      // Caching via the Next.js fetch cache so the public profile route renders
      // fast even under viral load — the API still has its own 5-minute Redis cache,
      // so this is a second layer of defence.
      next: { revalidate: options.revalidate ?? 60 },
    })
    if (!res.ok) return null
    const json = (await res.json()) as GraphQLResponse<T>
    if (json.errors && json.errors.length > 0) return null
    return json.data ?? null
  } catch {
    return null
  }
}
