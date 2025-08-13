/**
 * Tests for errors/index.js
 */
/* global describe, test, expect */
import { AiCommitError } from '../../src/errors/index.js'
import { ErrorCodes } from '../../src/errors/codes.js'

describe('Error Handling', () => {
  describe('AiCommitError', () => {
    test('should create error with default properties', () => {
      const error = new AiCommitError('Test error')

      expect(error).toBeInstanceOf(Error)
      expect(error.message).toBe('Test error')
      expect(error.code).toBe(ErrorCodes.GENERIC_ERROR)
      expect(error.category).toBe('generic')
      expect(error.originalError).toBeUndefined()
    })

    test('should create error with custom code', () => {
      const error = new AiCommitError('API error', null, { code: ErrorCodes.API_ERROR })

      expect(error.message).toBe('API error')
      expect(error.code).toBe(ErrorCodes.API_ERROR)
      expect(error.category).toBe('api')
    })

    test('should create error with original error', () => {
      const originalError = new Error('Original error')
      const error = new AiCommitError('Wrapper error', null, { originalError })

      expect(error.message).toBe('Wrapper error')
      expect(error.originalError).toBe(originalError)
    })

    test('should create error with custom category', () => {
      const error = new AiCommitError('Git error', 'git')

      expect(error.message).toBe('Git error')
      expect(error.category).toBe('git')
    })

    test('should handle error code mapping correctly', () => {
      const apiError = new AiCommitError('API error', null, { code: ErrorCodes.API_ERROR })
      expect(apiError.category).toBe('api')

      const gitError = new AiCommitError('Git error', null, { code: ErrorCodes.GIT_NOT_REPOSITORY })
      expect(gitError.category).toBe('git')

      const securityError = new AiCommitError('Security error', null, { code: ErrorCodes.SECURITY_VIOLATION })
      expect(securityError.category).toBe('security')
    })

    test('should provide stack trace', () => {
      const error = new AiCommitError('Test error')
      expect(error.stack).toBeDefined()
      expect(error.stack).toContain('AiCommitError: Test error')
    })

    test('should be instanceof Error', () => {
      const error = new AiCommitError('Test error')
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(AiCommitError)
    })
  })

  describe('ErrorCodes', () => {
    test('should have all expected error codes', () => {
      expect(ErrorCodes).toBeDefined()
      expect(ErrorCodes.GENERIC_ERROR).toBeDefined()
      expect(ErrorCodes.API_ERROR).toBeDefined()
      expect(ErrorCodes.GIT_ERROR).toBeDefined()
      expect(ErrorCodes.VALIDATION_ERROR).toBeDefined()
      expect(ErrorCodes.SECURITY_ERROR).toBeDefined()
    })

    test('should have unique error codes', () => {
      const codes = Object.values(ErrorCodes)
      const uniqueCodes = new Set(codes)
      expect(codes.length).toBe(uniqueCodes.size)
    })
  })
})
