import { filterApi } from '../../filterApi.js'
import { ApiClient } from '../api/client.js'
import { ValidationError } from '../errors/index.js'
import { ErrorCodes } from '../errors/codes.js'

/**
 * Generates commit messages using AI-powered prompts
 *
 * This class handles the creation of conventional commit messages by:
 * 1. Building appropriate prompts based on version and file count
 * 2. Communicating with AI services
 * 3. Processing and formatting the generated responses
 */
export class CommitGenerator {
  #apiClient
  #verbose

  /**
   * Creates a new CommitGenerator instance
   * @param {ApiClient} apiClient - The API client for AI communication
   * @param {boolean} verbose - Whether to enable verbose logging
   * @throws {ValidationError} When apiClient is invalid
   */
  constructor (apiClient, verbose = false) {
    if (!apiClient || !(apiClient instanceof ApiClient)) {
      throw new ValidationError(
        'API client is required and must be an instance of ApiClient',
        'apiClient',
        { code: ErrorCodes.VALIDATION_REQUIRED }
      )
    }
    this.#apiClient = apiClient
    this.#verbose = Boolean(verbose)
  }

  /**
   * Gets the API client instance
   * @returns {ApiClient} The API client
   */
  get apiClient () {
    return this.#apiClient
  }

  /**
   * Gets the verbose logging flag
   * @returns {boolean} True if verbose logging is enabled
   */
  get verbose () {
    return this.#verbose
  }

  /**
   * Gets prompt templates for generating commit messages
   *
   * @param {string} version - The prompt version ('v03' or 'v04')
   * @param {string} suffix - The prompt suffix ('' or 's' for single/multiple files)
   * @returns {Function} Function that takes gitDiff and returns prompt lines
   * @throws {ValidationError} When version is invalid
   */
  getPrompts (version = 'v04', suffix = '') {
    const validVersions = ['v03', 'v04']
    if (!validVersions.includes(version)) {
      throw new ValidationError(
        `Invalid prompt version: ${version}. Valid options are: ${validVersions.join(', ')}`,
        'version',
        { code: ErrorCodes.VALIDATION_INVALID_FORMAT }
      )
    }

    const createSeparator = (text) => `${'-'.repeat(7)}${text}${'-'.repeat(7)}`

    const baseInstructions = `
- Identify the type of changes made in the diff, such as \`feat\`, \`fix\`, \`docs\`, \`style\`, \`refactor\`, \`test\`, or \`chore\`: <type>
- If necessary, select a scope from files, directories, or topics: <scope>
- Choose a gitmoji icon character that corresponds to the type of changes made in the diff, such as 🚀 for \`feat\`, 🐛 for \`fix\`, 📝 for \`docs\`, 🎨 for \`style\`, ♻️ for \`refactor\`, 🧪 for \`test\`, or 🔧 for \`chore\`: <gitmoji>
- Ensure that the subject begins with an imperative verb and is no longer than 40 characters: <subject>
`.trim()

    const v03Template = `
Please provide a conventional commit message following this template:
${createSeparator('Begin-Template')}
<type>(scope): <gitmoji> - <subject>

<description>
${createSeparator('End-Template')}
Given the following git diff:
${createSeparator('Begin-GitDiff')}
${'<git-diff>'}
${createSeparator('End-GitDiff')}
Remember that the goal of a commit message is to provide a clear and concise summary of the changes made, which will be helpful for future developers who are working on the project.
Analyze the given git diff and make sure to:
${baseInstructions}
`.trim()

    const v04Template = `
Please provide a conventional commit message following this [template]:
[template]='''
<type>(scope): <gitmoji> - <subject>

<description>
'''
Given the following [git diff]:
[git diff]='''
${'<git-diff>'}
'''
Remember that the goal of a commit message is to provide a clear and concise summary of the changes made, which will be helpful for future developers who are working on the project.
Analyze the given git diff and make sure to:
${baseInstructions}
`.trim()

    const prompts = {
      ok: (gitDiff) => this.getPrompts(version, 's')(gitDiff),
      oks: (gitDiff) => this.getPrompts(version, 's')(gitDiff),
      v03: (gitDiff) => v03Template.replace('<git-diff>', gitDiff).split('\n'),
      v03s: (gitDiff) => [
        ...v03Template.replace('<git-diff>', gitDiff).split('\n'),
        '- Ensure that the description is a list with all changes, updates, additions, and deletions made for each file in the git diff in detail, using bullet points and nothing else!: <description>'
      ],
      v04: (gitDiff) => v04Template.replace('<git-diff>', gitDiff).split('\n'),
      v04s: (gitDiff) => [
        ...v04Template.replace('<git-diff>', gitDiff).split('\n'),
        '- Ensure that the description is a list with all changes, updates, additions, and deletions made for each file in the git diff in detail, using bullet points and nothing else!: <description>'
      ]
    }

    return prompts[version + suffix]
  }

  async generateSingleCommit (gitDiff, version = 'v04') {
    if (!gitDiff || typeof gitDiff !== 'string') {
      throw new ValidationError(
        'Git diff is required and must be a string',
        'gitDiff',
        { code: ErrorCodes.VALIDATION_REQUIRED }
      )
    }

    if (gitDiff.length > 100000) { // 100KB limit
      throw new ValidationError(
        'Git diff is too large (max 100KB)',
        'gitDiff',
        { code: ErrorCodes.VALIDATION_LENGTH }
      )
    }

    try {
      const prompt = this.getPrompts(version, '')(gitDiff).join('\n')

      if (this.verbose) {
        console.info(`Prompt text -> \n${prompt}\n`)
      }

      try {
        const filterResult = await filterApi({ prompt, filterFee: false })
        if (!filterResult) {
          return null
        }
      } catch (error) {
        throw new ValidationError(
          `Failed to filter API request: ${error.message}`,
          null,
          { code: ErrorCodes.API_ERROR }
        )
      }

      console.warn('Using model  -> ', this.apiClient.model)
      console.log('Commit get message ...')

      try {
        const response = await this.apiClient.sendMessage(prompt)
        const processedResponse = this.processResponse(response)

        console.log(
          `Proposed Commit: \n------------------------------\n${processedResponse} \n------------------------------`
        )

        return processedResponse
      } catch (error) {
        if (error.code === ErrorCodes.API_RATE_LIMIT) {
          // For rate limit errors, we might want to retry or give a more specific message
          throw new ValidationError(
            `Failed to generate commit message: ${error.message}`,
            null,
            { code: ErrorCodes.API_RATE_LIMIT, originalError: error }
          )
        }
        throw new ValidationError(
          `Failed to generate commit message: ${error.message}`,
          null,
          { code: ErrorCodes.API_ERROR, originalError: error }
        )
      }
    } catch (error) {
      throw new ValidationError(
        `Failed to generate single commit: ${error.message}`,
        null,
        { code: ErrorCodes.API_ERROR, originalError: error }
      )
    }
  }

  async generateSingleCommitAll (gitDiff, version = 'v04') {
    if (!gitDiff || typeof gitDiff !== 'string') {
      throw new ValidationError(
        'Git diff is required and must be a string',
        'gitDiff',
        { code: ErrorCodes.VALIDATION_REQUIRED }
      )
    }

    if (gitDiff.length > 100000) { // 100KB limit
      throw new ValidationError(
        'Git diff is too large (max 100KB)',
        'gitDiff',
        { code: ErrorCodes.VALIDATION_LENGTH }
      )
    }

    try {
      const prompt = this.getPrompts(version, 's')(gitDiff).join('\n')

      if (this.verbose) {
        console.info(`Prompt text -> \n${prompt}\n`)
      }

      try {
        const filterResult = await filterApi({ prompt, filterFee: false })
        if (!filterResult) {
          return null
        }
      } catch (error) {
        throw new ValidationError(
          `Failed to filter API request: ${error.message}`,
          null,
          { code: ErrorCodes.API_ERROR }
        )
      }

      console.warn('Using model  -> ', this.apiClient.model)
      console.log('Commit all get message ...')

      try {
        const response = await this.apiClient.sendMessage(prompt)
        const processedResponse = this.processResponse(response)

        console.log(
          `Proposed Commit: \n------------------------------\n${processedResponse} \n------------------------------`
        )

        return processedResponse
      } catch (error) {
        if (error.code === ErrorCodes.API_RATE_LIMIT) {
          throw new ValidationError(
            `Failed to generate commit message for all files: ${error.message}`,
            null,
            { code: ErrorCodes.API_RATE_LIMIT, originalError: error }
          )
        }
        throw new ValidationError(
          `Failed to generate commit message for all files: ${error.message}`,
          null,
          { code: ErrorCodes.API_ERROR, originalError: error }
        )
      }
    } catch (error) {
      throw new ValidationError(
        `Failed to generate single commit for all files: ${error.message}`,
        null,
        { code: ErrorCodes.API_ERROR, originalError: error }
      )
    }
  }

  processResponse (text) {
    if (!text || typeof text !== 'string') {
      throw new ValidationError(
        'Response text is required and must be a string',
        'text',
        { code: ErrorCodes.VALIDATION_REQUIRED }
      )
    }

    if (text.length > 50000) { // 50KB limit
      throw new ValidationError(
        'Response text is too large (max 50KB)',
        'text',
        { code: ErrorCodes.VALIDATION_LENGTH }
      )
    }

    return this.split90(text)
      .replaceAll('```\n', '')
      .replaceAll('\n```', '')
      .trim()
  }

  /**
   * Splits text into lines with maximum 90 characters per line
   *
   * This is an optimized algorithm that:
   * 1. Preserves existing line breaks
   * 2. Splits long lines at word boundaries
   * 3. Maintains readability while respecting length constraints
   *
   * @param {string} text - The text to split
   * @returns {string} The text with lines no longer than 90 characters
   */
  split90 (text) {
    if (!text || text.length <= 90) return text

    const lines = text.split('\n')
    const result = []

    for (const line of lines) {
      const trimmedLine = line.trim()
      if (!trimmedLine) {
        result.push('')
        continue
      }

      const words = trimmedLine.split(' ')
      let currentLine = words[0]

      for (let i = 1; i < words.length; i++) {
        const testLine = currentLine + ' ' + words[i]
        if (testLine.length <= 90) {
          currentLine = testLine
        } else {
          result.push(currentLine)
          currentLine = words[i]
        }
      }

      if (currentLine) {
        result.push(currentLine)
      }
    }

    return result.join('\n')
  }

  async generateReleaseSummary (commitsText) {
    if (!commitsText || typeof commitsText !== 'string') {
      throw new ValidationError(
        'Commits text is required and must be a string',
        'commitsText',
        { code: ErrorCodes.VALIDATION_REQUIRED }
      )
    }

    if (commitsText.length > 50000) { // 50KB limit
      throw new ValidationError(
        'Commits text is too large (max 50KB)',
        'commitsText',
        { code: ErrorCodes.VALIDATION_LENGTH }
      )
    }

    try {
      const prompt = `Craft a concise, imperative sentence (less than 80 characters) that distills the essence of the previous release, based on a thorough analysis of the Git commit messages. What key features, bug fixes, or improvements can be highlighted in a single, action-oriented statement? Consider the tone and style of the sentence, ensuring it's clear, concise, and engaging for developers and users alike. Provide a sentence that begins with a verb like 'Fix', 'Improve', 'Enhance', or 'Optimize', and includes relevant details from the commit messages:\n[Git commits]\n${commitsText}`

      console.log('Getting release summary ...')
      if (this.verbose) {
        console.info(`Prompt text -> \n${prompt}\n`)
      }

      try {
        const response = await this.apiClient.sendMessage(prompt)
        const processedResponse = response
          .replaceAll('"', '')
          .replaceAll('```\n', '')
          .replaceAll('\n```', '')
          .trim()

        // Truncate at the first line if it contains multiple lines
        const firstLine = processedResponse.split('\n')[0]
        return firstLine.trim()
      } catch (error) {
        if (error.code === ErrorCodes.API_RATE_LIMIT) {
          throw new ValidationError(
            `Failed to generate release summary: ${error.message}`,
            null,
            { code: ErrorCodes.API_RATE_LIMIT, originalError: error }
          )
        }
        throw new ValidationError(
          `Failed to generate release summary: ${error.message}`,
          null,
          { code: ErrorCodes.API_ERROR, originalError: error }
        )
      }
    } catch (error) {
      throw new ValidationError(
        `Failed to generate release summary: ${error.message}`,
        null,
        { code: ErrorCodes.API_ERROR, originalError: error }
      )
    }
  }
}
