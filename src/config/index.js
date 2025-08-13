import * as dotenv from 'dotenv'
import { ConfigurationError } from '../errors/index.js'

dotenv.config()

export class Config {
  static get apiKey () {
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new ConfigurationError('OPENAI_API_KEY or OPENROUTER_API_KEY environment variable is required')
    }
    return apiKey
  }

  static get model () {
    return process.env.OPENROUTER_MODEL || process.env.OPENAI_MODEL || 'openrouter/auto'
  }

  static get verbose () {
    return process.env.AI_COMMIT_VERBOSE === 'true'
  }

  static get force () {
    return process.env.AI_COMMIT_FORCE === 'true'
  }

  static get filterFee () {
    return process.env.AI_COMMIT_FILTER_FEE === 'true'
  }

  static get unified () {
    const unified = parseInt(process.env.AI_COMMIT_UNIFIED)
    return isNaN(unified) ? 1 : unified
  }

  static get all () {
    return process.env.AI_COMMIT_ALL === 'true'
  }

  static get release () {
    return process.env.AI_COMMIT_RELEASE === 'true'
  }

  static get prompt () {
    const prompt = process.env.AI_COMMIT_PROMPT || 'v04'
    const validPrompts = ['v03', 'v04', 'v03s', 'v04s']
    if (!validPrompts.includes(prompt)) {
      throw new ConfigurationError(`Invalid prompt version: ${prompt}. Valid options are: ${validPrompts.join(', ')}`)
    }
    return prompt
  }

  static validate () {
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
