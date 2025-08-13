import { fetch } from 'undici'
import { ApiError } from '../errors/index.js'

export class ApiClient {
  constructor (apiKey, model = 'openrouter/auto') {
    if (!apiKey) {
      throw new ApiError('API key is required')
    }
    this.apiKey = apiKey
    this.model = model
  }

  async sendMessage (message) {
    if (!message || typeof message !== 'string') {
      throw new ApiError('Message is required and must be a string')
    }

    try {
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
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new ApiError(
          `API request failed with status ${response.status}: ${errorData.error?.message || 'Unknown error'}`,
          response.status,
          errorData
        )
      }

      const data = await response.json()

      if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
        throw new ApiError('Invalid API response format')
      }

      return data.choices[0].message.content
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      throw new ApiError(`Failed to send message to API: ${error.message}`)
    }
  }
}
