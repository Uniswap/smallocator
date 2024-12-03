export const config = {
  envSchema: {
    type: 'object',
    required: ['PRIVATE_KEY'],
    properties: {
      PORT: {
        type: 'string',
        default: '3000'
      },
      PRIVATE_KEY: {
        type: 'string'
      },
      CORS_ORIGIN: {
        type: 'string',
        default: '*'
      },
      DATABASE_URL: {
        type: 'string',
        default: 'sqlite://smallocator.db'
      },
      INDEXER_URL: {
        type: 'string',
        default: 'https://api.thegraph.com/subgraphs/name/uniswap/the-compact'
      }
    }
  }
};
