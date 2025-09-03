/**
 * Configuration module for AI Commit tool.
 * Handles loading environment variables and CLI arguments with validation.
 */

import * as dotenv from 'dotenv'
import { ConfigurationError } from '../errors/index.js'

// Constants for default values and validation
const DEFAULT_MODEL = 'openrouter/auto'
const DEFAULT_PROMPT = 'v04'
const DEFAULT_UNIFIED = 1
const VALID_PROMPTS = ['v03', 'v04', 'v03s', 'v04s']

/**
 * Loads environment variables from .env file with error handling.
 * Uses quiet mode to suppress warnings if .env is missing.
 */
try {
  dotenv.config({ quiet: true })
} catch (error) {
  throw new ConfigurationError(`Failed to load environment configuration: ${error.message}`)
}

/**
 * Configuration class that manages application settings from CLI args and environment variables.
 * Prioritizes CLI arguments over environment variables.
 */
export class Config {
  /**
   * @param {Object} cliArgs - Command line arguments object
   */
  constructor (cliArgs = {}) {
    this.cliArgs = cliArgs
  }

  /**
   * Gets the API key from CLI args or environment variables.
   * @returns {string} The API key
   * @throws {ConfigurationError} If no API key is provided
   */
  get apiKey () {
    const apiKey = this.cliArgs.apiKey || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      throw new ConfigurationError('OPENAI_API_KEY or OPENROUTER_API_KEY environment variable is required and must be a non-empty string')
    }
    return apiKey.trim()
  }

  /**
   * Gets the model name.
   * @returns {string} The model name
   */
  get model () {
    return this.cliArgs.model || process.env.OPENROUTER_MODEL || process.env.OPENAI_MODEL || DEFAULT_MODEL
  }

  /**
   * Gets verbose mode flag.
   * @returns {boolean} True if verbose mode is enabled
   */
  get verbose () {
    return this._parseBoolean(this.cliArgs.verbose) || this._parseBoolean(process.env.AI_COMMIT_VERBOSE)
  }

  /**
   * Gets force mode flag.
   * @returns {boolean} True if force mode is enabled
   */
  get force () {
    return this._parseBoolean(this.cliArgs.force) || this._parseBoolean(process.env.AI_COMMIT_FORCE)
  }

  /**
   * Gets filter fee flag.
   * @returns {boolean} True if filter fee is enabled
   */
  get filterFee () {
    return this._parseBoolean(this.cliArgs.filterFee) || this._parseBoolean(process.env.AI_COMMIT_FILTER_FEE)
  }

  /**
   * Gets the unified diff context lines.
   * @returns {number} Number of unified context lines (minimum 1)
   */
  get unified () {
    const unified = Number.parseInt(this.cliArgs.unified || process.env.AI_COMMIT_UNIFIED, 10)
    return Number.isNaN(unified) || unified < 1 ? DEFAULT_UNIFIED : Math.max(1, unified)
  }

  /**
   * Gets all files flag.
   * @returns {boolean} True if all files should be processed
   */
  get all () {
    return this._parseBoolean(this.cliArgs.all) || this._parseBoolean(process.env.AI_COMMIT_ALL)
  }

  /**
   * Gets release mode flag.
   * @returns {boolean} True if release mode is enabled
   */
  get release () {
    return this._parseBoolean(this.cliArgs.release) || this._parseBoolean(process.env.AI_COMMIT_RELEASE)
  }

  /**
   * Gets the prompt version.
   * @returns {string} The prompt version
   * @throws {ConfigurationError} If invalid prompt version is provided
   */
  get prompt () {
    const prompt = this.cliArgs.prompt || (process.env.AI_COMMIT_PROMPT ?? DEFAULT_PROMPT)
    if (!VALID_PROMPTS.includes(prompt)) {
      throw new ConfigurationError(`Invalid prompt version: ${prompt}. Valid options are: ${VALID_PROMPTS.join(', ')}`)
    }
    return prompt
  }

  /**
   * Validates the configuration by checking required properties.
   * @returns {boolean} True if validation passes, false if invalid
   */
  validate () {
    try {
      // Trigger validation for all required properties
      // eslint-disable-next-line no-unused-expressions
      this.apiKey
      // eslint-disable-next-line no-unused-expressions
      this.prompt
      return true
    } catch (error) {
      if (error instanceof ConfigurationError) {
        return false
      }
      throw new ConfigurationError(`Configuration validation failed: ${error.message}`)
    }
  }

  /**
   * Helper method to parse boolean values from strings or booleans.
   * @param {*} value - Value to parse
   * @returns {boolean} Parsed boolean value
   * @private
   */
  _parseBoolean (value) {
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') return value.toLowerCase() === 'true'
    return false
  }
}
