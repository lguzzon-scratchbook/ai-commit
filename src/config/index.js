import * as dotenv from 'dotenv'
import { ConfigurationError } from '../errors/index.js'

dotenv.config()

export class Config {
  constructor (cliArgs = {}) {
    this.cliArgs = cliArgs
  }

  get apiKey () {
    const apiKey = this.cliArgs.apiKey || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new ConfigurationError('OPENAI_API_KEY or OPENROUTER_API_KEY environment variable is required')
    }
    return apiKey
  }

  get model () {
    return this.cliArgs.model || process.env.OPENROUTER_MODEL || process.env.OPENAI_MODEL || 'openrouter/auto'
  }

  get verbose () {
    return this.cliArgs.verbose === true || process.env.AI_COMMIT_VERBOSE === 'true'
  }

  get force () {
    return this.cliArgs.force === true || process.env.AI_COMMIT_FORCE === 'true'
  }

  get filterFee () {
    return this.cliArgs.filterFee === true || process.env.AI_COMMIT_FILTER_FEE === 'true'
  }

  get unified () {
    const unified = parseInt(this.cliArgs.unified || process.env.AI_COMMIT_UNIFIED)
    return isNaN(unified) ? 1 : unified
  }

  get all () {
    return this.cliArgs.all === true || process.env.AI_COMMIT_ALL === 'true'
  }

  get release () {
    return this.cliArgs.release === true || process.env.AI_COMMIT_RELEASE === 'true'
  }

  get prompt () {
    const prompt = this.cliArgs.prompt || (process.env.AI_COMMIT_PROMPT ?? 'v04')
    const validPrompts = ['v03', 'v04', 'v03s', 'v04s']
    if (!validPrompts.includes(prompt)) {
      throw new ConfigurationError(`Invalid prompt version: ${prompt}. Valid options are: ${validPrompts.join(', ')}`)
    }
    return prompt
  }

  validate () {
    try {
      // Validate required properties by accessing them
      console.log(this.apiKey)
      console.log(this.prompt)
      return true
    } catch (error) {
      if (error instanceof ConfigurationError) {
        throw error
      }
      throw new ConfigurationError(`Configuration validation failed: ${error.message}`)
    }
  }
}
