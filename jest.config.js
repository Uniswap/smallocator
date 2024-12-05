/** @type {import('jest').Config} */
export default {
  transform: {},
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testMatch: ['**/src/__tests__/**/*.test.ts'],
  testEnvironment: 'node',
  // Support for sharding tests across multiple CI jobs
  shard: process.env.JEST_SHARD,
};
