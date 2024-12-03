export const config = {
  envSchema: {
    type: 'object',
    required: ['PRIVATE_KEY', 'ALLOCATOR_ADDRESS', 'SIGNING_ADDRESS'],
    properties: {
      PORT: {
        type: 'string',
        default: '3000',
      },
      PRIVATE_KEY: {
        type: 'string',
      },
      CORS_ORIGIN: {
        type: 'string',
        default: '*',
      },
      DATABASE_URL: {
        type: 'string',
        default: 'sqlite://smallocator.db',
      },
      INDEXER_URL: {
        type: 'string',
        default: 'https://the-compact-indexer-2.ponder-dev.com/',
      },
      ALLOCATOR_ADDRESS: {
        type: 'string',
      },
      SIGNING_ADDRESS: {
        type: 'string',
      },
    },
  },
};
