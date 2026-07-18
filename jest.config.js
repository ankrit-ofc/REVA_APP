/**
 * Minimal Jest setup for pure-TS units (no React Native rendering).
 * ts-jest compiles on the fly; the `@/` path alias mirrors tsconfig.json.
 */
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        // Override the Expo base config: jest runs under plain Node/CommonJS.
        tsconfig: {
          module: 'commonjs',
          moduleResolution: 'node',
          customConditions: null,
          types: ['jest', 'node'],
        },
      },
    ],
  },
}
