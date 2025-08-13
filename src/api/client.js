import { fetch } from 'undici'
import { ApiError } from '../errors/index.js'
import { ErrorCodes } from '../errors/codes.js'

export class ApiClient {
  constructor (apiKey, model = 'openrouter/auto') {
    if (!apiKey) {
      throw new ApiError('API key is required', null, { code: ErrorCodes.API_AUTH_FAILED })
    }
    this.apiKey = apiKey
    this.model = model
  }

  async sendMessage (message) {
    if (!message || typeof message !== 'string') {
      throw new ApiError('Message is required and must be a string', null, { code: ErrorCodes.VALIDATION_REQUIRED })
    }

    try {
      // Add timeout handling
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://ai-commit.lucaguzzon.com',
          'X-Title': 'ai-commit',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          top_p: 0.2,
          messages: [
            { role: 'user', content: message }
          ]
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        let errorData = {}
        try {
          errorData = await response.json()
        } catch {
          // Ignore JSON parsing errors
        }

        let errorCode = ErrorCodes.API_ERROR
        let errorMessage = `API request failed with status ${response.status}`

        if (response.status === 429) {
          errorCode = ErrorCodes.API_RATE_LIMIT
          errorMessage = 'API rate limit exceeded. Please try again later.'
        } else if (response.status >= 500) {
          errorCode = ErrorCodes.API_SERVICE_UNAVAILABLE
          errorMessage = 'API service is currently unavailable'
        }

        throw new ApiError(
          errorMessage,
          response.status,
          errorData,
          { code: errorCode }
        )
      }

      const data = await response.json()

      // Validate response structure more thoroughly
      if (!data.choices?.[0]?.message?.content) {
        throw new ApiError(
          'Invalid API response format: missing required fields',
          null,
          { code: ErrorCodes.API_INVALID_RESPONSE }
        )
      }

      const content = data.choices[0].message.content.trim()
      if (!content) {
        throw new ApiError(
          'API returned empty response',
          null,
          { code: ErrorCodes.API_INVALID_RESPONSE }
        )
      }

      return content
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }

      // Handle network errors and timeouts
      if (error.name === 'AbortError') {
        throw new ApiError(
          'API request timed out',
          null,
          { code: ErrorCodes.API_TIMEOUT }
        )
      }

      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new ApiError(
          'Failed to connect to API service',
          null,
          { code: ErrorCodes.API_CONNECTION_FAILED }
        )
      }

      throw new ApiError(
        `Failed to send message to API: ${error.message}`,
        null,
        { code: ErrorCodes.API_ERROR }
      )
    }
  }
}
