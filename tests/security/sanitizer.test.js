/**
 * Tests for security/sanitizer.js
 */
/* global describe, test, expect */
import {
  sanitizeShellInput,
  isValidGitRef,
  isValidUnifiedValue,
  isValidFilePath,
  escapeGitArg
} from '../../src/security/sanitizer.js'

describe('Security Sanitizer', () => {
  describe('sanitizeShellInput', () => {
    test('should sanitize shell metacharacters', () => {
      const input = 'test; rm -rf /'
      const result = sanitizeShellInput(input)
      expect(result).toBe('test\\; rm -rf /')
    })

    test('should remove control characters', () => {
      const input = 'test\x00\x1F\x7F'
      const result = sanitizeShellInput(input)
      expect(result).toBe('test')
    })

    test('should allow spaces when allowSpaces is true', () => {
      const input = 'test file name'
      const result = sanitizeShellInput(input, true)
      expect(result).toBe('test file name')
    })

    test('should throw error for non-string input', () => {
      expect(() => sanitizeShellInput(null)).toThrow(TypeError)
      expect(() => sanitizeShellInput(123)).toThrow(TypeError)
    })
  })

  describe('isValidGitRef', () => {
    test('should validate valid git refs', () => {
      expect(isValidGitRef('feature/new-feature')).toBe(true)
      expect(isValidGitRef('v1.0.0')).toBe(true)
      expect(isValidGitRef('hotfix/fix-bug')).toBe(true)
      expect(isValidGitRef('123')).toBe(true)
    })

    test('should reject invalid git refs', () => {
      expect(isValidGitRef('')).toBe(false)
      expect(isValidGitRef('..')).toBe(false)
      expect(isValidGitRef('...')).toBe(false)
      expect(isValidGitRef('feature/..')).toBe(false)
      expect(isValidGitRef('feature/')).toBe(false)
      expect(isValidGitRef('/feature')).toBe(false)
      expect(isValidGitRef('feature name')).toBe(false)
      expect(isValidGitRef('feature\nname')).toBe(false)
    })

    test('should reject non-string input', () => {
      expect(isValidGitRef(null)).toBe(false)
      expect(isValidGitRef(123)).toBe(false)
    })
  })

  describe('isValidUnifiedValue', () => {
    test('should validate valid unified values', () => {
      expect(isValidUnifiedValue(0)).toBe(true)
      expect(isValidUnifiedValue(1)).toBe(true)
      expect(isValidUnifiedValue(5)).toBe(true)
      expect(isValidUnifiedValue(10)).toBe(true)
      expect(isValidUnifiedValue('3')).toBe(true)
      expect(isValidUnifiedValue('0')).toBe(true)
    })

    test('should reject invalid unified values', () => {
      expect(isValidUnifiedValue(-1)).toBe(false)
      expect(isValidUnifiedValue(11)).toBe(false)
      expect(isValidUnifiedValue('abc')).toBe(false)
      expect(isValidUnifiedValue('3.5')).toBe(false)
      expect(isValidUnifiedValue(null)).toBe(false)
      expect(isValidUnifiedValue(undefined)).toBe(false)
    })
  })

  describe('isValidFilePath', () => {
    test('should validate valid file paths', () => {
      expect(isValidFilePath('test.js')).toBe(true)
      expect(isValidFilePath('src/app.js')).toBe(true)
      expect(isValidFilePath('folder/file.txt')).toBe(true)
      expect(isValidFilePath('path/to/nested/file.js')).toBe(true)
    })

    test('should reject invalid file paths', () => {
      expect(isValidFilePath('')).toBe(false)
      expect(isValidFilePath('test\x00file')).toBe(false)
      expect(isValidFilePath('test; rm -rf')).toBe(false)
      expect(isValidFilePath('../secret')).toBe(false)
      expect(isValidFilePath('test/../secret')).toBe(false)
      expect(isValidFilePath('test/\nfile')).toBe(false)
      expect(isValidFilePath('test/\rfile')).toBe(false)
      expect(isValidFilePath('test/\tfile')).toBe(false)
    })

    test('should reject non-string input', () => {
      expect(isValidFilePath(null)).toBe(false)
      expect(isValidFilePath(123)).toBe(false)
    })
  })

  describe('escapeGitArg', () => {
    test('should escape double quotes', () => {
      const input = 'test"quote'
      const result = escapeGitArg(input)
      expect(result).toBe('test\\"quote')
    })

    test('should not escape other characters', () => {
      const input = 'test-file.js'
      const result = escapeGitArg(input)
      expect(result).toBe('test-file.js')
    })

    test('should throw error for non-string input', () => {
      expect(() => escapeGitArg(null)).toThrow(TypeError)
      expect(() => escapeGitArg(123)).toThrow(TypeError)
    })
  })
})
