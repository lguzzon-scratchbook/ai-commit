/**
 * Jest configuration for ai-commit
 */
export default {
  // Test environment
  testEnvironment: 'node',

  // Module file extensions to import
  moduleFileExtensions: ['js', 'json'],

  // Transform configuration
  transform: {
    '^.+\\.js$': 'jest-esm-transformer'
  },

  // Module name mapper for importing modules from src
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^src/(.*)$': '<rootDir>/src/$1'
  },

  // Test match patterns
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.js',
    '<rootDir>/src/**/?(*.)+(spec|test).js'
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/*.spec.js',
    '!src/**/__tests__/**',
    '!src/index.js',
    '!src/main.js'
  ],

  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Test timeout
  testTimeout: 10000,

  // Verbose output
  verbose: true,

  // Enable esm modules
  extensionsToTreatAsEsm: ['.js'],
  globals: {
    'ts-jest': {
      useESM: true
    },
    // Jest globals for test files
    describe: true,
    test: true,
    it: true,
    expect: true,
    jest: true,
    beforeEach: true,
    afterEach: true,
    beforeAll: true,
    afterAll: true
  }
}
