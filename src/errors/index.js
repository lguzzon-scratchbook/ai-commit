export class AiCommitError extends Error {
  constructor (message, code = 'AI_COMMIT_ERROR') {
    super(message)
    this.name = this.constructor.name
    this.code = code
    this.date = new Date()
  }
}

export class ConfigurationError extends AiCommitError {
  constructor (message) {
    super(message, 'CONFIGURATION_ERROR')
  }
}

export class GitError extends AiCommitError {
  constructor (message, command = null) {
    super(message, 'GIT_ERROR')
    this.command = command
  }
}

export class ApiError extends AiCommitError {
  constructor (message, statusCode = null, response = null) {
    super(message, 'API_ERROR')
    this.statusCode = statusCode
    this.response = response
  }
}

export class ValidationError extends AiCommitError {
  constructor (message, field = null) {
    super(message, 'VALIDATION_ERROR')
    this.field = field
  }
}
