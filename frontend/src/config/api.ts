// Default to production URL
const DEFAULT_GRAPHQL_URL = 'https://the-compact-indexer-2.ponder-dev.com/'

interface Config {
  graphqlUrl: string
}

export const config: Config = {
  graphqlUrl: import.meta.env.VITE_GRAPHQL_INDEXER_URL || DEFAULT_GRAPHQL_URL,
}
