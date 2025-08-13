/**
 * Tests for commit/generator.js
 */
/* global describe, test, expect, jest, beforeEach */
import { CommitGenerator } from '../../src/commit/generator.js'
import { ApiClient } from '../../src/api/client.js'
import { ValidationError } from '../../src/errors/index.js'
import { ErrorCodes } from '../../src/errors/codes.js'

// Mock the ApiClient
jest.mock('../../src/api/client.js')

describe('CommitGenerator', () => {
  let mockApiClient
  let commitGenerator

  beforeEach(() => {
    mockApiClient = new ApiClient('test-key', 'test-model')
    commitGenerator = new CommitGenerator(mockApiClient, false)
  })

  describe('constructor', () => {
    test('should create instance with valid api client', () => {
      expect(commitGenerator).toBeInstanceOf(CommitGenerator)
      expect(commitGenerator.apiClient).toBe(mockApiClient)
      expect(commitGenerator.verbose).toBe(false)
    })

    test('should throw error with invalid api client', () => {
      expect(() => new CommitGenerator(null)).toThrow(ValidationError)
      expect(() => new CommitGenerator('not an instance')).toThrow(ValidationError)
    })

    test('should set verbose flag correctly', () => {
      const verboseGenerator = new CommitGenerator(mockApiClient, true)
      expect(verboseGenerator.verbose).toBe(true)
    })
  })

  describe('getPrompts', () => {
    test('should return prompts for valid version', () => {
      const prompts = commitGenerator.getPrompts('v04')
      expect(prompts).toBeDefined()
      expect(Array.isArray(prompts)).toBe(true)
      expect(prompts.length).toBeGreaterThan(0)
    })

    test('should return prompts with suffix', () => {
      const prompts = commitGenerator.getPrompts('v04', 's')
      expect(prompts).toBeDefined()
      expect(Array.isArray(prompts)).toBe(true)
    })

    test('should throw error for invalid version', () => {
      expect(() => commitGenerator.getPrompts('invalid')).toThrow(ValidationError)
      expect(() => commitGenerator.getPrompts('v02')).toThrow(ValidationError)
    })

    test('should validate version parameter', () => {
      const validVersions = ['v03', 'v04']
      validVersions.forEach(version => {
        expect(() => commitGenerator.getPrompts(version)).not.toThrow()
      })
    })
  })

  describe('generateSingleCommit', () => {
    test('should generate commit message successfully', async () => {
      const mockDiff = 'diff --git a/test.js b/test.js\nnew file mode 100644\nindex 0000000..1234567\n--- /dev/null\n+++ b/test.js\n@@ -0,0 +1 @@\n+test content\n'

      mockApiClient.sendMessage = jest.fn().mockResolvedValue('feat(test): add test file')

      const result = await commitGenerator.generateSingleCommit(mockDiff)

      expect(result).toBe('feat(test): add test file')
      expect(mockApiClient.sendMessage).toHaveBeenCalled()
    })

    test('should throw error for invalid git diff', async () => {
      await expect(commitGenerator.generateSingleCommit(null)).rejects.toThrow(ValidationError)
      await expect(commitGenerator.generateSingleCommit(123)).rejects.toThrow(ValidationError)
      await expect(commitGenerator.generateSingleCommit('')).rejects.toThrow(ValidationError)
    })

    test('should return null when filterApi returns false', async () => {
      // Mock filterApi to return false
      jest.doMock('../../filterApi.js', () => ({
        filterApi: jest.fn().mockResolvedValue(false)
      }))

      const result = await commitGenerator.generateSingleCommit('test diff')
      expect(result).toBeNull()
    })

    test('should handle API errors gracefully', async () => {
      mockApiClient.sendMessage = jest.fn().mockRejectedValue(new Error('API Error'))

      await expect(commitGenerator.generateSingleCommit('test diff')).rejects.toThrow(ValidationError)
    })

    test('should handle rate limit errors specifically', async () => {
      const rateLimitError = new Error('Rate limit exceeded')
      rateLimitError.code = ErrorCodes.API_RATE_LIMIT

      mockApiClient.sendMessage = jest.fn().mockRejectedValue(rateLimitError)

      await expect(commitGenerator.generateSingleCommit('test diff')).rejects.toThrow(ValidationError)
    })
  })

  describe('generateSingleCommitAll', () => {
    test('should generate commit message for all files', async () => {
      const mockDiff = 'diff --git a/file1.js b/file1.js\nnew file mode 100644\nindex 0000000..1234567\n--- /dev/null\n+++ b/file1.js\n@@ -0,0 +1 @@\n+content\n'

      mockApiClient.sendMessage = jest.fn().mockResolvedValue('feat: add multiple files')

      const result = await commitGenerator.generateSingleCommitAll(mockDiff)

      expect(result).toBe('feat: add multiple files')
      expect(mockApiClient.sendMessage).toHaveBeenCalled()
    })

    test('should throw error for invalid git diff', async () => {
      await expect(commitGenerator.generateSingleCommitAll(null)).rejects.toThrow(ValidationError)
      await expect(commitGenerator.generateSingleCommitAll(123)).rejects.toThrow(ValidationError)
    })
  })

  describe('generateReleaseSummary', () => {
    test('should generate release summary successfully', async () => {
      const commitsText = 'feat: add new feature\nfix: resolve bug\n'

      mockApiClient.sendMessage = jest.fn().mockResolvedValue('feat: add new feature and fix bug')

      const result = await commitGenerator.generateReleaseSummary(commitsText)

      expect(result).toBe('feat: add new feature and fix bug')
      expect(mockApiClient.sendMessage).toHaveBeenCalled()
    })

    test('should throw error for invalid commits text', async () => {
      await expect(commitGenerator.generateReleaseSummary(null)).rejects.toThrow(ValidationError)
      await expect(commitGenerator.generateReleaseSummary(123)).rejects.toThrow(ValidationError)
      await expect(commitGenerator.generateReleaseSummary('')).rejects.toThrow(ValidationError)
    })

    test('should truncate response to first line', async () => {
      const commitsText = 'test commits'

      mockApiClient.sendMessage = jest.fn().mockResolvedValue('Line 1\nLine 2\nLine 3')

      const result = await commitGenerator.generateReleaseSummary(commitsText)

      expect(result).toBe('Line 1')
    })

    test('should clean up response formatting', async () => {
      const commitsText = 'test commits'

      mockApiClient.sendMessage = jest.fn().mockResolvedValue('"```multi\nline\nresponse```"')

      const result = await commitGenerator.generateReleaseSummary(commitsText)

      expect(result).toBe('multi\nline\nresponse')
    })
  })

  describe('processResponse', () => {
    test('should process response text correctly', () => {
      const response = 'This is a long line that should be wrapped properly according to the 90-character limit rule'
      const result = commitGenerator.processResponse(response)

      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    test('should throw error for invalid response text', () => {
      expect(() => commitGenerator.processResponse(null)).toThrow(ValidationError)
      expect(() => commitGenerator.processResponse(123)).toThrow(ValidationError)
      expect(() => commitGenerator.processResponse('')).toThrow(ValidationError)
    })

    test('should remove code block markers', () => {
      const response = '```\ntest content\n```'
      const result = commitGenerator.processResponse(response)

      expect(result).toBe('test content')
    })
  })

  describe('split90', () => {
    test('should split text into 90-character lines', () => {
      const longText = 'This is a very long line that exceeds ninety characters and should be split into multiple lines for better readability'
      const result = commitGenerator.split90(longText)

      expect(result).toBeDefined()
      expect(typeof result).toBe('string')

      // Check that no line exceeds 90 characters
      const lines = result.split('\n')
      lines.forEach(line => {
        expect(line.length).toBeLessThanOrEqual(90)
      })
    })

    test('should handle empty text', () => {
      const result = commitGenerator.split90('')
      expect(result).toBe('')
    })

    test('should handle text with multiple spaces', () => {
      const text = 'word1    word2    word3'
      const result = commitGenerator.split90(text)

      expect(result).toBeDefined()
      expect(result.length).toBeGreaterThan(0)
    })
  })
})
