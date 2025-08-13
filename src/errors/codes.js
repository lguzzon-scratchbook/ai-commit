/**
 * Standardized error codes for ai-commit application
 * All codes follow the pattern: E[DOMAIN][SUBDOMAIN][SPECIFIC]
 * Where:
 * - DOMAIN: 1=Application, 2=Configuration, 3=Git, 4=API, 5=Validation, 6=Security
 * - SUBDOMAIN: 00-99 (specific to domain)
 * - SPECIFIC: 00-99 (specific error within subdomain)
 */

export const ErrorCodes = {
  // Application Errors (1xxx)
  APPLICATION_ERROR: 1000,
  APPLICATION_INIT_FAILED: 1001,
  APPLICATION_SHUTDOWN_FAILED: 1002,
  APPLICATION_TIMEOUT: 1003,

  // Configuration Errors (2xxx)
  CONFIGURATION_ERROR: 2000,
  CONFIGURATION_MISSING: 2001,
  CONFIGURATION_INVALID: 2002,
  CONFIGURATION_FILE_NOT_FOUND: 2003,
  CONFIGURATION_PARSE_ERROR: 2004,
  CONFIGURATION_ENV_VAR_MISSING: 2005,

  // Git Errors (3xxx)
  GIT_ERROR: 3000,
  GIT_NOT_REPOSITORY: 3001,
  GIT_NO_CHANGES: 3002,
  GIT_COMMIT_FAILED: 3003,
  GIT_TAG_FAILED: 3004,
  GIT_DIFF_FAILED: 3005,
  GIT_LOG_FAILED: 3006,
  GIT_STAGING_FAILED: 3007,
  GIT_COMMAND_TIMEOUT: 3008,
  GIT_INVALID_REF: 3009,

  // API Errors (4xxx)
  API_ERROR: 4000,
  API_CONNECTION_FAILED: 4001,
  API_TIMEOUT: 4002,
  API_RATE_LIMIT: 4003,
  API_AUTH_FAILED: 4004,
  API_INVALID_RESPONSE: 4005,
  API_SERVICE_UNAVAILABLE: 4006,

  // Validation Errors (5xxx)
  VALIDATION_ERROR: 5000,
  VALIDATION_REQUIRED: 5001,
  VALIDATION_INVALID_FORMAT: 5002,
  VALIDATION_LENGTH: 5003,
  VALIDATION_TYPE: 5004,
  VALIDATION_RANGE: 5005,
  VALIDATION_PATTERN: 5006,

  // Security Errors (6xxx)
  SECURITY_ERROR: 6000,
  SECURITY_INJECTION_ATTEMPT: 6001,
  SECURITY_INVALID_INPUT: 6002,
  SECURITY_PERMISSION_DENIED: 6003,
  SECURITY_TOKEN_INVALID: 6004,
  SECURITY_AUTH_REQUIRED: 6005
}

/**
 * Error code to message mapping
 */
export const ErrorMessages = {
  [ErrorCodes.APPLICATION_ERROR]: 'Application error occurred',
  [ErrorCodes.APPLICATION_INIT_FAILED]: 'Failed to initialize application',
  [ErrorCodes.APPLICATION_SHUTDOWN_FAILED]: 'Failed to shutdown application gracefully',
  [ErrorCodes.APPLICATION_TIMEOUT]: 'Operation timed out',

  [ErrorCodes.CONFIGURATION_ERROR]: 'Configuration error occurred',
  [ErrorCodes.CONFIGURATION_MISSING]: 'Required configuration is missing',
  [ErrorCodes.CONFIGURATION_INVALID]: 'Configuration is invalid',
  [ErrorCodes.CONFIGURATION_FILE_NOT_FOUND]: 'Configuration file not found',
  [ErrorCodes.CONFIGURATION_PARSE_ERROR]: 'Failed to parse configuration',
  [ErrorCodes.CONFIGURATION_ENV_VAR_MISSING]: 'Required environment variable is missing',

  [ErrorCodes.GIT_ERROR]: 'Git operation failed',
  [ErrorCodes.GIT_NOT_REPOSITORY]: 'Not a git repository',
  [ErrorCodes.GIT_NO_CHANGES]: 'No changes to commit',
  [ErrorCodes.GIT_COMMIT_FAILED]: 'Failed to commit changes',
  [ErrorCodes.GIT_TAG_FAILED]: 'Failed to create tag',
  [ErrorCodes.GIT_DIFF_FAILED]: 'Failed to generate diff',
  [ErrorCodes.GIT_LOG_FAILED]: 'Failed to get git log',
  [ErrorCodes.GIT_STAGING_FAILED]: 'Failed to get staged files',
  [ErrorCodes.GIT_COMMAND_TIMEOUT]: 'Git command timed out',
  [ErrorCodes.GIT_INVALID_REF]: 'Invalid git reference',

  [ErrorCodes.API_ERROR]: 'API operation failed',
  [ErrorCodes.API_CONNECTION_FAILED]: 'Failed to connect to API',
  [ErrorCodes.API_TIMEOUT]: 'API request timed out',
  [ErrorCodes.API_RATE_LIMIT]: 'API rate limit exceeded',
  [ErrorCodes.API_AUTH_FAILED]: 'API authentication failed',
  [ErrorCodes.API_INVALID_RESPONSE]: 'Invalid API response',
  [ErrorCodes.API_SERVICE_UNAVAILABLE]: 'API service unavailable',

  [ErrorCodes.VALIDATION_ERROR]: 'Validation failed',
  [ErrorCodes.VALIDATION_REQUIRED]: 'Required field is missing',
  [ErrorCodes.VALIDATION_INVALID_FORMAT]: 'Invalid format',
  [ErrorCodes.VALIDATION_LENGTH]: 'Invalid length',
  [ErrorCodes.VALIDATION_TYPE]: 'Invalid type',
  [ErrorCodes.VALIDATION_RANGE]: 'Value out of range',
  [ErrorCodes.VALIDATION_PATTERN]: 'Value does not match required pattern',

  [ErrorCodes.SECURITY_ERROR]: 'Security error occurred',
  [ErrorCodes.SECURITY_INJECTION_ATTEMPT]: 'Potential command injection detected',
  [ErrorCodes.SECURITY_INVALID_INPUT]: 'Invalid input for security validation',
  [ErrorCodes.SECURITY_PERMISSION_DENIED]: 'Permission denied',
  [ErrorCodes.SECURITY_TOKEN_INVALID]: 'Invalid security token',
  [ErrorCodes.SECURITY_AUTH_REQUIRED]: 'Authentication required'
}

/**
 * Get error message for a given error code
 * @param {number} code - Error code
 * @returns {string} Error message
 */
export function getErrorMessage (code) {
  return ErrorMessages[code] || 'Unknown error'
}

/**
 * Get error category for a given error code
 * @param {number} code - Error code
 * @returns {string} Error category
 */
export function getErrorCategory (code) {
  if (code >= 1000 && code < 2000) return 'application'
  if (code >= 2000 && code < 3000) return 'configuration'
  if (code >= 3000 && code < 4000) return 'git'
  if (code >= 4000 && code < 5000) return 'api'
  if (code >= 5000 && code < 6000) return 'validation'
  if (code >= 6000 && code < 7000) return 'security'
  return 'unknown'
}

/**
 * Check if an error code is retryable
 * @param {number} code - Error code
 * @returns {boolean} True if retryable
 */
export function isRetryable (code) {
  const retryableCategories = ['api', 'git']
  return retryableCategories.includes(getErrorCategory(code))
}

/**
 * Get HTTP status code equivalent for error code
 * @param {number} code - Error code
 * @returns {number} HTTP status code
 */
export function getHttpStatusCode (code) {
  const category = getErrorCategory(code)

  switch (category) {
    case 'application':
      return 500
    case 'configuration':
      return 400
    case 'git':
      return 400
    case 'api':
      return code === ErrorCodes.API_RATE_LIMIT ? 429 : 500
    case 'validation':
      return 422
    case 'security':
      return 403
    default:
      return 500
  }
}
