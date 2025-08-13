import { filterApi } from '../../filterApi.js'
import { ApiClient } from '../api/client.js'
import { ValidationError } from '../errors/index.js'

export class CommitGenerator {
  constructor (apiClient, verbose = false) {
    if (!apiClient || !(apiClient instanceof ApiClient)) {
      throw new ValidationError(
        'API client is required and must be an instance of ApiClient',
        'apiClient'
      )
    }
    this.apiClient = apiClient
    this.verbose = Boolean(verbose)
  }

  getPrompts (version = 'v04', suffix = '') {
    const validVersions = ['v03', 'v04']
    if (!validVersions.includes(version)) {
      throw new ValidationError(
        `Invalid prompt version: ${version}. Valid options are: ${validVersions.join(', ')}`,
        'version'
      )
    }

    const beginTemplateTag = 'Begin-Template'
    const endTemplateTag = 'End-Template'
    const beginGitDiffTag = 'Begin-GitDiff'
    const endGitDiffTag = 'End-GitDiff'

    const separator = (text) => `${'-'.repeat(7)}${text}${'-'.repeat(7)}`

    const prompts = {
      ok: function (gitDiff) {
        return this[`ok${suffix}`](gitDiff)
      },
      oks: function (gitDiff) {
        return this[`oks${suffix}`](gitDiff)
      },
      v03: (gitDiff) => [
        ...prompts.v03_head(gitDiff),
        '- Ensure, using bullet points, to list all changes, updates, additions, and deletions made in the git diff in detail and include nothing else: <description>'
      ],
      v03s: (gitDiff) => [
        ...prompts.v03_head(gitDiff),
        '- Ensure that the description is a list with all changes, updates, additions, and deletions made for each file in the git diff in detail, using bullet points and nothing else!: <description>'
      ],
      v03_head: (gitDiff) => [
        'Please provide a conventional commit message following this template:',
        `${separator(beginTemplateTag)}`,
        '<type>(scope): <gitmoji> - <subject>',
        '',
        '<description>',
        `${separator(endTemplateTag)}`,
        'Given the following git diff:',
        `${separator(beginGitDiffTag)}`,
        gitDiff,
        `${separator(endGitDiffTag)}`,
        'Remember that the goal of a commit message is to provide a clear and concise summary of the changes made, which will be helpful for future developers who are working on the project.',
        'Analyze the given git diff and make sure to:',
        '- Identify the type of changes made in the diff, such as `feat`, `fix`, `docs`, `style`, `refactor`, `test`, or `chore`: <type>',
        '- If necessary, select a scope from files, directories, or topics: <scope>',
        '- Choose a gitmoji icon character that corresponds to the type of changes made in the diff, such as 🚀 for `feat`, 🐛 for `fix`, 📝 for `docs`, 🎨 for `style`, ♻️ for `refactor`, 🧪 for `test`, or 🔧 for `chore`: <gitmoji>',
        '- Ensure that the subject begins with an imperative verb and is no longer than 40 characters: <subject>'
      ],
      v04: (gitDiff) => [
        ...prompts.v04_head(gitDiff),
        '- Ensure, using bullet points, to list all changes, updates, additions, and deletions made in the git diff in detail and include nothing else: <description>'
      ],
      v04s: (gitDiff) => [
        ...prompts.v04_head(gitDiff),
        '- Ensure that the description is a list with all changes, updates, additions, and deletions made for each file in the git diff in detail, using bullet points and nothing else!: <description>'
      ],
      v04_head: (gitDiff) => [
        'Please provide a conventional commit message following this [template]:',
        "[template]='''",
        '<type>(scope): <gitmoji> - <subject>',
        '',
        '<description>',
        "'''",
        'Given the following [git diff]:',
        "[git diff]='''",
        gitDiff,
        "'''",
        'Remember that the goal of a commit message is to provide a clear and concise summary of the changes made, which will be helpful for future developers who are working on the project.',
        'Analyze the given git diff and make sure to:',
        '- Identify the type of changes made in the diff, such as `feat`, `fix`, `docs`, `style`, `refactor`, `test`, or `chore`: <type>',
        '- If necessary, select a scope from files, directories, or topics: <scope>',
        '- Choose a gitmoji icon character that corresponds to the type of changes made in the diff, such as 🚀 for `feat`, 🐛 for `fix`, 📝 for `docs`, 🎨 for `style`, ♻️ for `refactor`, 🧪 for `test`, or 🔧 for `chore`: <gitmoji>',
        '- Ensure that the subject begins with an imperative verb and is no longer than 40 characters: <subject>'
      ]
    }

    return prompts[version + suffix]
  }

  async generateSingleCommit (gitDiff, version = 'v04') {
    if (!gitDiff || typeof gitDiff !== 'string') {
      throw new ValidationError(
        'Git diff is required and must be a string',
        'gitDiff'
      )
    }

    try {
      const prompt = this.getPrompts(version, '')(gitDiff).join('\n')

      if (this.verbose) {
        console.info(`Prompt text -> \n${prompt}\n`)
      }

      if (!(await filterApi({ prompt, filterFee: false }))) {
        return null
      }

      console.warn('Using model  -> ', this.apiClient.model)
      console.log('Commit get message ...')

      const response = await this.apiClient.sendMessage(prompt)
      const processedResponse = this.processResponse(response)

      console.log(
        `Proposed Commit: \n------------------------------\n${processedResponse} \n------------------------------`
      )

      return processedResponse
    } catch (error) {
      throw new ValidationError(
        `Failed to generate single commit: ${error.message}`
      )
    }
  }

  async generateSingleCommitAll (gitDiff, version = 'v04') {
    if (!gitDiff || typeof gitDiff !== 'string') {
      throw new ValidationError(
        'Git diff is required and must be a string',
        'gitDiff'
      )
    }

    try {
      const prompt = this.getPrompts(version, 's')(gitDiff).join('\n')

      if (this.verbose) {
        console.info(`Prompt text -> \n${prompt}\n`)
      }

      if (!(await filterApi({ prompt, filterFee: false }))) {
        return null
      }

      console.warn('Using model  -> ', this.apiClient.model)
      console.log('Commit all get message ...')

      const response = await this.apiClient.sendMessage(prompt)
      const processedResponse = this.processResponse(response)

      console.log(
        `Proposed Commit: \n------------------------------\n${processedResponse} \n------------------------------`
      )

      return processedResponse
    } catch (error) {
      throw new ValidationError(
        `Failed to generate single commit for all files: ${error.message}`
      )
    }
  }

  processResponse (text) {
    if (!text || typeof text !== 'string') {
      throw new ValidationError(
        'Response text is required and must be a string',
        'text'
      )
    }

    return this.split90(text)
      .replaceAll('```\n', '')
      .replaceAll('\n```', '')
      .trim()
  }

  split90 (text) {
    return text
      .split('\n')
      .map((line) => {
        const words = line.trim().split(' ')
        const result = []
        for (let i = 0; i < words.length; i++) {
          if (result.length === 0) {
            result.push(words[i])
          } else {
            const last = result[result.length - 1]
            if ((last + ' ' + words[i]).length > 90) {
              result.push(words[i])
            } else {
              result[result.length - 1] = last + ' ' + words[i]
            }
          }
        }
        return result.join('\n  ')
      })
      .join('\n')
  }

  async generateReleaseSummary (commitsText) {
    if (!commitsText || typeof commitsText !== 'string') {
      throw new ValidationError(
        'Commits text is required and must be a string',
        'commitsText'
      )
    }

    try {
      const prompt = `Craft a concise, imperative sentence (less than 80 characters) that distills the essence of the previous release, based on a thorough analysis of the Git commit messages. What key features, bug fixes, or improvements can be highlighted in a single, action-oriented statement? Consider the tone and style of the sentence, ensuring it's clear, concise, and engaging for developers and users alike. Provide a sentence that begins with a verb like 'Fix', 'Improve', 'Enhance', or 'Optimize', and includes relevant details from the commit messages:\n[Git commits]\n${commitsText}`

      console.log('Getting release summary ...')
      if (this.verbose) {
        console.info(`Prompt text -> \n${prompt}\n`)
      }

      const response = await this.apiClient.sendMessage(prompt)
      return response
        .replaceAll('"', '')
        .replaceAll('```\n', '')
        .replaceAll('\n```', '')
        .trim()
    } catch (error) {
      throw new ValidationError(
        `Failed to generate release summary: ${error.message}`
      )
    }
  }
}
