import { ErrorCodes } from '../errors/codes.js'

/**
 * Validates commit messages according to conventional commit standards
 */
export class CommitMessageValidator {
  /**
   * Valid conventional commit types
   */
  static get VALID_TYPES () {
    return [
      'feat', 'fix', 'docs', 'style', 'refactor', 'test', 'chore',
      'perf', 'ci', 'build', 'revert', 'wip', 'workflow'
    ]
  }

  /**
   * Valid gitmojis for each commit type
   */
  static get GITMOJIS () {
    return {
      feat: '✨',
      fix: '🐛',
      docs: '📝',
      style: '🎨',
      refactor: '♻️',
      test: '🧪',
      chore: '🔧',
      perf: '⚡',
      ci: '👷',
      build: '🛠️',
      revert: '🗑️',
      wip: '🚧',
      workflow: '⚙️'
    }
  }

  /**
   * Validates a commit message against conventional commit standards
   *
   * @param {string} message - The commit message to validate
   * @param {Object} options - Validation options
   * @param {boolean} options.requireGitmoji - Whether gitmoji is required
   * @param {boolean} options.requireScope - Whether scope is required
   * @param {number} options.maxLength - Maximum message length
   * @param {number} options.subjectMaxLength - Maximum subject length
   * @returns {Object} Validation result with isValid and details
   */
  static validate (message, options = {}) {
    const {
      requireGitmoji = false,
      requireScope = false,
      maxLength = 72,
      subjectMaxLength = 50
    } = options

    if (!message || typeof message !== 'string') {
      return {
        isValid: false,
        errors: ['Commit message is required and must be a string'],
        details: { code: ErrorCodes.VALIDATION_REQUIRED }
      }
    }

    const trimmedMessage = message.trim()
    if (!trimmedMessage) {
      return {
        isValid: false,
        errors: ['Commit message cannot be empty'],
        details: { code: ErrorCodes.VALIDATION_REQUIRED }
      }
    }

    const errors = []
    const details = {
      type: null,
      scope: null,
      subject: null,
      gitmoji: null,
      hasDescription: false
    }

    // Parse the commit message
    const parseResult = this.parseCommitMessage(trimmedMessage)
    Object.assign(details, parseResult)

    // Validate type
    if (!details.type) {
      errors.push('Commit type is required')
    } else if (!this.VALID_TYPES.includes(details.type)) {
      errors.push(`Invalid commit type: ${details.type}. Valid types are: ${this.VALID_TYPES.join(', ')}`)
    }

    // Validate scope if required
    if (requireScope && !details.scope) {
      errors.push('Scope is required but not provided')
    }

    // Validate gitmoji if required
    if (requireGitmoji && !details.gitmoji) {
      errors.push('Gitmoji is required but not provided')
    }

    // Validate gitmoji matches type
    if (details.gitmoji && details.type) {
      const expectedGitmoji = this.GITMOJIS[details.type]
      if (expectedGitmoji && details.gitmoji !== expectedGitmoji) {
        errors.push(`Gitmoji ${details.gitmoji} does not match commit type ${details.type}. Expected: ${expectedGitmoji}`)
      }
    }

    // Validate subject
    if (!details.subject) {
      errors.push('Commit subject is required')
    } else {
      // Check subject length
      if (details.subject.length > subjectMaxLength) {
        errors.push(`Subject is too long (${details.subject.length} chars). Maximum is ${subjectMaxLength} characters`)
      }

      // Check for imperative mood
      if (!this.isImperativeMood(details.subject)) {
        errors.push('Subject should be in imperative mood (e.g., "Add feature" not "Added feature")')
      }

      // Check capitalization
      if (details.subject[0] !== details.subject[0].toUpperCase()) {
        errors.push('Subject should start with a capital letter')
      }

      // Check for trailing punctuation
      if (details.subject.endsWith('.')) {
        errors.push('Subject should not end with a period')
      }
    }

    // Validate overall message length
    if (trimmedMessage.length > maxLength) {
      errors.push(`Commit message is too long (${trimmedMessage.length} chars). Maximum is ${maxLength} characters`)
    }

    // Check for forbidden words
    const forbiddenWords = ['fixme', 'hack', 'todo', 'bug']
    const lowerMessage = trimmedMessage.toLowerCase()
    const foundForbiddenWords = forbiddenWords.filter(word => lowerMessage.includes(word))

    if (foundForbiddenWords.length > 0) {
      errors.push(`Commit message contains forbidden words: ${foundForbiddenWords.join(', ')}`)
    }

    // Check for proper spacing
    if (details.scope && !trimmedMessage.includes(`(${details.scope}):`)) {
      errors.push('Scope should be properly formatted as (scope):')
    }

    return {
      isValid: errors.length === 0,
      errors,
      details
    }
  }

  /**
   * Parses a commit message into its components
   *
   * @param {string} message - The commit message to parse
   * @returns {Object} Parsed components
   */
  static parseCommitMessage (message) {
    const result = {
      type: null,
      scope: null,
      subject: null,
      gitmoji: null,
      hasDescription: false
    }

    // Extract gitmoji if present
    const gitmojiMatch = message.match(/^(\p{Emoji}\s+)/u)
    if (gitmojiMatch) {
      result.gitmoji = gitmojiMatch[1].trim()
      message = message.substring(gitmojiMatch[1].length).trim()
    }

    // Match conventional commit format
    const conventionalMatch = message.match(/^(\w+)(?:\(([^)]+)\))?:\s*(.+?)(?:\n\n(.+))?$/s)

    if (conventionalMatch) {
      result.type = conventionalMatch[1]
      result.scope = conventionalMatch[2] || null
      result.subject = conventionalMatch[3].trim()
      result.hasDescription = !!conventionalMatch[4]
    } else {
      // Try to extract type and subject from non-conventional format
      const parts = message.split(':')
      if (parts.length >= 2) {
        result.type = parts[0].trim()
        result.subject = parts.slice(1).join(':').trim()
      } else {
        result.subject = message.trim()
      }
    }

    return result
  }

  /**
   * Checks if a string is in imperative mood
   *
   * @param {string} text - The text to check
   * @returns {boolean} True if in imperative mood
   */
  static isImperativeMood (text) {
    if (!text || typeof text !== 'string') return false

    // Common imperative verbs
    const imperativeVerbs = [
      'add', 'update', 'fix', 'remove', 'delete', 'create', 'implement',
      'refactor', 'optimize', 'improve', 'enhance', 'change', 'modify',
      'rename', 'move', 'copy', 'install', 'uninstall', 'build', 'test',
      'run', 'start', 'stop', 'restart', 'deploy', 'release', 'document',
      'style', 'format', 'lint', 'validate', 'check', 'verify', 'ensure',
      'make', 'build', 'compile', 'bundle', 'minify', 'uglify', 'process',
      'generate', 'create', 'write', 'read', 'parse', 'serialize', 'deserialize',
      'connect', 'disconnect', 'open', 'close', 'lock', 'unlock', 'enable', 'disable'
    ]

    const firstWord = text.split(' ')[0].toLowerCase()
    return imperativeVerbs.includes(firstWord)
  }

  /**
   * Suggests improvements for a commit message
   *
   * @param {string} message - The commit message to improve
   * @returns {Object} Suggestions for improvement
   */
  static suggestImprovements (message) {
    const suggestions = []
    const validation = this.validate(message)

    if (!validation.isValid) {
      suggestions.push(...validation.errors.map(error => `❌ ${error}`))
    }

    const parsed = validation.details

    // Suggest gitmoji if missing
    if (!parsed.gitmoji && parsed.type) {
      const suggestedGitmoji = this.GITMOJIS[parsed.type]
      if (suggestedGitmoji) {
        suggestions.push(`✨ Consider adding gitmoji: ${suggestedGitmoji}`)
      }
    }

    // Suggest scope if applicable
    if (!parsed.scope && parsed.type && ['feat', 'fix', 'docs', 'style', 'refactor'].includes(parsed.type)) {
      suggestions.push(`📝 Consider adding scope: (${parsed.type}): description`)
    }

    // Suggest imperative mood
    if (parsed.subject && !this.isImperativeMood(parsed.subject)) {
      suggestions.push(`🎯 Use imperative mood: "${this.toImperative(parsed.subject)}"`)
    }

    // Suggest capitalization
    if (parsed.subject && parsed.subject[0] !== parsed.subject[0].toUpperCase()) {
      suggestions.push(`🔤 Capitalize subject: "${parsed.subject[0].toUpperCase()}${parsed.subject.slice(1)}"`)
    }

    return {
      isValid: validation.isValid,
      suggestions,
      originalMessage: message,
      suggestedFormat: this.formatSuggestion(parsed)
    }
  }

  /**
   * Converts a string to imperative mood
   *
   * @param {string} text - The text to convert
   * @returns {string} Imperative form
   */
  static toImperative (text) {
    if (!text || typeof text !== 'string') return text

    // Simple conversion rules
    const conversions = {
      added: 'Add',
      changes: 'Change',
      changed: 'Change',
      creating: 'Create',
      created: 'Create',
      deleting: 'Delete',
      deleted: 'Delete',
      fixing: 'Fix',
      fixed: 'Fix',
      installing: 'Install',
      installed: 'Install',
      removing: 'Remove',
      removed: 'Remove',
      updating: 'Update',
      updated: 'Update'
    }

    const firstWord = text.split(' ')[0].toLowerCase()
    if (conversions[firstWord]) {
      return `${conversions[firstWord]}${text.slice(firstWord.length)}`
    }

    return text
  }

  /**
   * Formats a suggestion based on parsed components
   *
   * @param {Object} parsed - Parsed commit message components
   * @returns {string} Formatted suggestion
   */
  static formatSuggestion (parsed) {
    let suggestion = ''

    if (parsed.gitmoji) {
      suggestion += `${parsed.gitmoji} `
    }

    if (parsed.type && parsed.scope) {
      suggestion += `${parsed.type}(${parsed.scope}): `
    } else if (parsed.type) {
      suggestion += `${parsed.type}: `
    }

    if (parsed.subject) {
      suggestion += parsed.subject
    }

    return suggestion
  }
}
