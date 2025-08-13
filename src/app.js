import inquirer from 'inquirer'
import { getServices } from './di/services.js'
import { ErrorCodes } from './errors/codes.js'
import { AiCommitError } from './errors/index.js'

/**
 * Main application class for AI-powered commit generation
 *
 * This class orchestrates the entire commit generation process, including
 * git operations, API communication, and user interaction.
 */
export class AiCommitApp {
  /**
   * Creates a new instance of AiCommitApp
   * @param {Object} services - Optional dependency injection services
   * @param {Object} services.config - Configuration manager
   * @param {Object} services.logger - Logger instance
   * @param {Object} services.apiClient - API client for AI communication
   * @param {Object} services.gitOps - Git operations handler
   * @param {Object} services.commitGenerator - Commit message generator
   */
  constructor (services = null) {
    this.services = services ?? getServices()
    this.config = this.services.config
    this.logger = this.services.logger
    this.apiClient = this.services.apiClient
    this.gitOps = this.services.gitOps
    this.commitGenerator = this.services.commitGenerator
  }

  /**
   * Runs the main application flow
   *
   * This method orchestrates the entire commit generation process:
   * 1. Validates configuration
   * 2. Finds git repository root
   * 3. Generates commit messages or release summaries based on CLI args
   * 4. Handles errors and exits with appropriate codes
   *
   * @returns {Promise<void>}
   * @throws {AiCommitError} When configuration validation or git operations fail
   */
  async run () {
    try {
      this.logger.info('ai-commit begin')

      this.config.validate()

      this.gitOps.findGitRoot()

      if (this.config.r || this.config.release) {
        await this.commitRelease()
      } else {
        await this.generateAICommit()
      }

      this.logger.info('ai-commit end')
    } catch (error) {
      this.logger.error(`Error: ${error.message}`)
      if (error instanceof AiCommitError) {
        // Use standardized exit codes based on error category
        const exitCode = error.category === 'git'
          ? 2
          : error.category === 'api'
            ? 3
            : error.category === 'security'
              ? 4
              : 1
        process.exit(exitCode)
      }
      process.exit(1)
    }
  }

  /**
   * Generates and creates a release summary from recent commits
   *
   * This method:
   * 1. Gets the latest git tag
   * 2. Finds commits since the last tag
   * 3. Generates a release summary using AI
   * 4. Creates a new release tag
   *
   * @returns {Promise<void>}
   * @throws {AiCommitError} When git operations or AI generation fails
   */
  async commitRelease () {
    try {
      const latestTag = this.gitOps.getLatestTag()
      const latestCommit = this.gitOps.getLatestCommit(latestTag ?? 'HEAD')

      if (!latestCommit) {
        console.log('No new commits since last release')
        return
      }

      this.logger.warn(`Using model -> ${this.config.model}`)

      const commitsText = this.gitOps.getCommitsText(latestCommit)
      const message =
        await this.commitGenerator.generateReleaseSummary(commitsText)

      if (!message) {
        throw new AiCommitError('Failed to generate release summary', null, {
          code: ErrorCodes.API_ERROR
        })
      }

      const nextTag = this.getNextTag(latestTag)
      await this.createRelease(nextTag, message)
      console.log('Release done!!!')
    } catch (error) {
      throw new AiCommitError(
        `Failed to create release: ${error.message}`,
        null,
        { code: ErrorCodes.RELEASE_ERROR }
      )
    }
  }

  /**
   * Generates AI-powered commit messages
   *
   * This method determines whether to commit all staged files individually
   * or generate a single commit message for all changes based on CLI arguments.
   *
   * @returns {Promise<void>}
   * @throws {AiCommitError} When not in a git repository or commit generation fails
   */
  async generateAICommit () {
    if (!this.gitOps.isInsideGitRepository()) {
      throw new AiCommitError('This is not a git repository 🙅‍♂️', null, {
        code: ErrorCodes.GIT_NOT_REPOSITORY
      })
    }

    if (this.config.all) {
      await this.commitAllFiles()
    } else {
      await this.commitEachFile()
    }
  }

  async commitAllFiles () {
    try {
      const diff = this.gitOps.getStagedDiff(null, this.getGitDiffUnified())

      if (!diff) {
        throw new AiCommitError(
          'No changes to commit. Try adding files with "git add ." and running this script again',
          null,
          { code: ErrorCodes.GIT_NO_CHANGES }
        )
      }

      const commitMessage =
        await this.commitGenerator.generateSingleCommitAll(diff)

      if (!commitMessage) {
        throw new AiCommitError('Failed to generate commit message', null, {
          code: ErrorCodes.API_ERROR
        })
      }

      if (this.config.force) {
        this.gitOps.commit(commitMessage, '.')
        return
      }

      const answer = await this.promptUser('Do you want to continue?', true)
      if (!answer.continue) {
        throw new AiCommitError('Commit aborted by user', null, {
          code: ErrorCodes.USER_ABORTED
        })
      }

      this.gitOps.commit(commitMessage, '.')
    } catch (error) {
      throw new AiCommitError(
        `Failed to commit all files: ${error.message}`,
        null,
        { code: ErrorCodes.GIT_COMMIT_FAILED }
      )
    }
  }

  async commitEachFile () {
    try {
      const stagedFiles = this.gitOps.getStagedFiles()

      for (const fileStatus of stagedFiles) {
        const [status, file] = fileStatus.trim().split('\t')

        if (!file) {
          continue
        }

        let commitMessage

        switch (status.trim().toUpperCase()) {
          case 'D':
            commitMessage = `chore(${file}):  - File deleted`
            break

          default: {
            const diff = this.gitOps.getStagedDiff(
              file,
              this.getGitDiffUnified()
            )

            if (!diff) {
              throw new AiCommitError(
                `No diff found for file ${file}. Try adding files with "git add ." and running this script again`,
                null,
                { code: ErrorCodes.GIT_NO_DIFF }
              )
            }

            commitMessage =
              await this.commitGenerator.generateSingleCommit(diff)
            break
          }
        }

        if (!commitMessage) {
          throw new AiCommitError(
            `Failed to generate commit message for file ${file}`,
            null,
            { code: ErrorCodes.API_ERROR }
          )
        }
        if (!this.config.force) {
          const answer = await this.promptUser(
            `Do you want to continue with commit for ${file}?`,
            true
          )
          if (!answer.continue) {
            throw new AiCommitError(
              `Commit aborted by user for file ${file}`,
              null,
              { code: ErrorCodes.USER_ABORTED }
            )
          }
        }

        this.gitOps.commit(commitMessage, file)
      }
    } catch (error) {
      throw new AiCommitError(
        `Failed to commit files: ${error.message}`,
        null,
        { code: ErrorCodes.GIT_COMMIT_FAILED }
      )
    }
  }

  /**
   * Prompts the user for confirmation
   *
   * @param {string} message - The confirmation message to display
   * @param {boolean} defaultValue - The default value for the confirmation
   * @returns {Promise<{continue: boolean}>} Object with continue property
   * @throws {AiCommitError} When user input fails
   */
  async promptUser (message, defaultValue = true) {
    try {
      const { continue: shouldContinue } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'continue',
          message,
          default: defaultValue
        }
      ])
      return { continue: shouldContinue }
    } catch (error) {
      throw new AiCommitError(`Failed to prompt user: ${error.message}`, null, {
        code: ErrorCodes.USER_INPUT_ERROR
      })
    }
  }

  getNextTag (tag) {
    return tag ? this.incrementTag(tag) : '0.0.0'
  }

  incrementTag (tag) {
    const parts = tag.split('.')
    if (parts.length === 3) {
      const major = parseInt(parts[0]) || 0
      const minor = parseInt(parts[1]) || 0
      const patch = parseInt(parts[2]) || 0
      return `${major}.${minor}.${patch + 1}`
    }
    return tag
  }

  async createRelease (tag, message) {
    try {
      if (!this.config.force) {
        console.log(`${tag} --> ${message}`)
        const { continue: shouldContinue } = await this.promptUser(
          'Do you want to continue?',
          true
        )
        if (!shouldContinue) {
          throw new AiCommitError('Commit aborted by user 🙅‍♂️', null, {
            code: ErrorCodes.USER_ABORTED
          })
        }
      }
      this.gitOps.createReleaseTag(tag, message)
    } catch (error) {
      throw new AiCommitError(
        `Failed to create release: ${error.message}`,
        null,
        { code: ErrorCodes.RELEASE_ERROR }
      )
    }
  }

  /**
   * Gets the unified diff value from CLI args or config
   *
   * @returns {number} The unified diff value (number of lines of context)
   */
  getGitDiffUnified () {
    return this.config.u ?? this.config.unified ?? this.config.unified
  }
}
