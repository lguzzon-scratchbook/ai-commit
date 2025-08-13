/**
 * Security utilities for preventing command injection vulnerabilities
 */

/**
 * Sanitizes a string for safe use in shell commands
 * @param {string} input - The input string to sanitize
 * @param {boolean} allowSpaces - Whether to allow spaces in the output
 * @returns {string} Sanitized string
 */
export function sanitizeShellInput (input, allowSpaces = false) {
  if (typeof input !== 'string') {
    throw new TypeError('Input must be a string')
  }

  // Remove null bytes and control characters
  let sanitized = input
  for (let i = 0; i <= 0x1F; i++) {
    sanitized = sanitized.replace(String.fromCharCode(i), '')
  }
  sanitized = sanitized.replace(String.fromCharCode(0x7F), '')

  // Escape shell metacharacters
  const metacharacters = allowSpaces
    ? ['"', "'", '`', '$', '&', ';', '>', '<', '|', '(', ')', '\\', '[', ']', '{', '}']
    : ['"', "'", '`', '$', '&', ';', '>', '<', '|', '(', ')', '\\', '[', ']', '{', '}', ' ']

  metacharacters.forEach(char => {
    sanitized = sanitized.replace(new RegExp(`\\${char}`, 'g'), `\\${char}`)
  })

  return sanitized
}

/**
 * Validates that a string contains only safe characters for git refs/tags
 * @param {string} input - The input string to validate
 * @returns {boolean} True if valid, false otherwise
 */
export function isValidGitRef (input) {
  if (typeof input !== 'string') return false

  // Git refs can contain: letters, numbers, dots, underscores, dashes, slashes
  // Cannot start with dot, dash, or slash
  // Cannot contain consecutive dots, double dots, or spaces
  const gitRefRegex = /^(?!\.)(?!-)[a-zA-Z0-9._/-]+(?<!\.)(?!-)$/
  return gitRefRegex.test(input) && !input.includes('..') && !input.includes(' ')
}

/**
 * Validates that a string is a safe unified diff value
 * @param {string|number} input - The input to validate
 * @returns {boolean} True if valid, false otherwise
 */
export function isValidUnifiedValue (input) {
  const num = parseInt(input)
  return !isNaN(num) && num >= 0 && num <= 10
}

/**
 * Validates that a file path is safe for git operations
 * @param {string} input - The file path to validate
 * @returns {boolean} True if valid, false otherwise
 */
export function isValidFilePath (input) {
  if (typeof input !== 'string') return false

  // Basic validation - no null bytes, no control chars, no shell metacharacters
  if (input.includes('\u0000')) {
    return false
  }
  for (let i = 1; i <= 0x1F; i++) {
    if (input.includes(String.fromCharCode(i))) {
      return false
    }
  }
  if (input.includes(String.fromCharCode(0x7F))) {
    return false
  }

  // Check for potentially dangerous patterns
  const dangerousPatterns = [
    /\.\.\//, // parent directory traversal
    /\.\.$/, // parent directory traversal at end
    /\/\s*$/, // trailing slash
    /^\s+|\s+$/, // leading/trailing whitespace
    /[;&|`$(){}[\]<>]/ // shell metacharacters
  ]

  return !dangerousPatterns.some(pattern => pattern.test(input))
}

/**
 * Escapes a string for use in git command arguments
 * @param {string} input - The input string to escape
 * @returns {string} Git-escaped string
 */
export function escapeGitArg (input) {
  if (typeof input !== 'string') {
    throw new TypeError('Input must be a string')
  }

  // Git uses double quotes for escaping, so we need to escape them
  return input.replace(/"/g, '\\"')
}
