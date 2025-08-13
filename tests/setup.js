/**
 * Jest setup file for ai-commit tests
 */
/* global jest, afterEach */

// Mock console methods in tests to reduce noise
global.console = {
  ...console
  // Uncomment to ignore specific console methods in tests
  // log: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
}

// Set test environment variables
process.env.NODE_ENV = 'test'
process.env.OPENAI_API_KEY = 'test-api-key'
process.env.OPENROUTER_API_KEY = 'test-router-key'
process.env.OPENROUTER_MODEL = 'test-model'
process.env.AI_COMMIT_VERBOSE = 'false'
process.env.AI_COMMIT_FORCE = 'false'
process.env.AI_COMMIT_FILTER_FEE = 'false'
process.env.AI_COMMIT_UNIFIED = '1'
process.env.AI_COMMIT_ALL = 'false'
process.env.AI_COMMIT_RELEASE = 'false'
process.env.AI_COMMIT_PROMPT = 'v04'

// Mock inquirer to avoid interactive prompts during tests
jest.mock('inquirer', () => ({
  prompt: jest.fn().mockResolvedValue({ continue: true })
}))

// Mock filterApi to avoid external API calls during tests
jest.mock('../filterApi.js', () => ({
  filterApi: jest.fn().mockResolvedValue(true)
}))

// Add global test utilities
global.testUtils = {
  createMockApiClient: () => ({
    model: 'test-model',
    sendMessage: jest.fn().mockResolvedValue('Test response'),
    setTimeout: jest.fn().mockResolvedValue('Timeout response')
  }),

  createMockGitOperations: () => ({
    findGitRoot: jest.fn(),
    isInsideGitRepository: jest.fn().mockReturnValue(true),
    getLatestTag: jest.fn().mockReturnValue('1.0.0'),
    getLatestCommit: jest.fn().mockReturnValue('abc123'),
    getCommitsText: jest.fn().mockReturnValue('Test commit message'),
    getStagedFiles: jest.fn().mockReturnValue(['M\ttest.js']),
    getStagedDiff: jest.fn().mockReturnValue('diff --git a/test.js b/test.js\nnew file mode 100644\nindex 0000000..1234567\n--- /dev/null\n+++ b/test.js\n@@ -0,0 +1 @@\n+test content\n'),
    commit: jest.fn().mockReturnValue(true),
    createReleaseTag: jest.fn().mockReturnValue(true)
  })
}

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks()
})
