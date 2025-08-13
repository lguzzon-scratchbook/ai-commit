import { ErrorCodes, getErrorMessage, getErrorCategory, getHttpStatusCode } from './codes.js'

export class AiCommitError extends Error {
  /**
   * Create a new AiCommitError
   * @param {string} message - Error message
   * @param {number} code - Error code from ErrorCodes
   * @param {Object} additionalData - Additional error data
   */
  constructor (message, code = ErrorCodes.APPLICATION_ERROR, additionalData = {}) {
    super(message || getErrorMessage(code))
    this.name = this.constructor.name
    this.code = code
    this.category = getErrorCategory(code)
    this.httpStatus = getHttpStatusCode(code)
    this.date = new Date()
    this.stack = new Error().stack

    // Add additional data
    Object.assign(this, additionalData)
  }

  /**
   * Convert error to JSON
   * @returns {Object} JSON representation
   */
  toJSON () {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      category: this.category,
      httpStatus: this.httpStatus,
      date: this.date.toISOString(),
      stack: this.stack,
      ...this
    }
  }

  /**
   * Check if error is retryable
   * @returns {boolean} True if retryable
   */
  isRetryable () {
    return this.category === 'api' || this.category === 'git'
  }
}

export class ConfigurationError extends AiCommitError {
  /**
   * Create a new ConfigurationError
   * @param {string} message - Error message
   * @param {Object} additionalData - Additional error data
   */
  constructor (message, additionalData = {}) {
    super(message, ErrorCodes.CONFIGURATION_ERROR, additionalData)
  }
}

export class GitError extends AiCommitError {
  /**
   * Create a new GitError
   * @param {string} message - Error message
   * @param {string} command - Git command that failed
   * @param {Object} additionalData - Additional error data
   */
  constructor (message, command = null, additionalData = {}) {
    const data = { command, ...additionalData }
    super(message, ErrorCodes.GIT_ERROR, data)
  }
}

export class ApiError extends AiCommitError {
  /**
   * Create a new ApiError
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   * @param {Object} response - API response
   * @param {Object} additionalData - Additional error data
   */
  constructor (message, statusCode = null, response = null, additionalData = {}) {
    const data = { statusCode, response, ...additionalData }
    const code = statusCode === 429 ? ErrorCodes.API_RATE_LIMIT : ErrorCodes.API_ERROR
    super(message, code, data)
  }
}

export class ValidationError extends AiCommitError {
  /**
   * Create a new ValidationError
   * @param {string} message - Error message
   * @param {string} field - Field that failed validation
   * @param {Object} additionalData - Additional error data
   */
  constructor (message, field = null, additionalData = {}) {
    const data = { field, ...additionalData }
    super(message, ErrorCodes.VALIDATION_ERROR, data)
  }
}

export class SecurityError extends AiCommitError {
  /**
   * Create a new SecurityError
   * @param {string} message - Error message
   * @param {Object} additionalData - Additional error data
   */
  constructor (message, additionalData = {}) {
    super(message, ErrorCodes.SECURITY_ERROR, additionalData)
  }
}
