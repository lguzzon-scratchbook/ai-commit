import inquirer from 'inquirer'
import { Config } from './config/index.js'
import { CliArgs } from './cli/args.js'
import { Logger } from './logger/index.js'
import { ApiClient } from './api/client.js'
import { GitOperations } from './git/operations.js'
import { CommitGenerator } from './commit/generator.js'
import { AiCommitError } from './errors/index.js'

export class AiCommitApp {
  constructor () {
    this.cliArgs = CliArgs.getAll()
    this.config = Config
    this.logger = new Logger(this.cliArgs.v || this.cliArgs.verbose)
    this.apiClient = new ApiClient(this.config.apiKey, this.config.model)
    this.gitOps = GitOperations
    this.commitGenerator = new CommitGenerator(this.apiClient, this.logger.verbose)
  }

  async run () {
    try {
      this.logger.info('ai-commit begin')

      this.config.validate()

      this.gitOps.findGitRoot()

      if (this.cliArgs.r || this.cliArgs.release) {
        await this.commitRelease()
      } else {
        await this.generateAICommit()
      }

      this.logger.info('ai-commit end')
    } catch (error) {
      this.logger.error(`Error: ${error.message}`)
      if (error instanceof AiCommitError) {
        process.exit(error.code === 'GIT_ERROR' ? 2 : 1)
      }
      process.exit(1)
    }
  }

  async commitRelease () {
    try {
      const latestTag = this.gitOps.getLatestTag()
      const latestCommit = this.gitOps.getLatestCommit(latestTag)

      if (!latestCommit) {
        console.log('No new commits since last release')
        return
      }

      this.logger.warn('Using model  -> ', this.config.model)

      const commitsText = this.gitOps.getCommitsText(latestCommit)
      const message = await this.promptUser(
        `Craft a concise, imperative sentence (less than 80 characters) that distills the essence of the previous release, based on a thorough analysis of the Git commit messages. What key features, bug fixes, or improvements can be highlighted in a single, action-oriented statement? Consider the tone and style of the sentence, ensuring it's clear, concise, and engaging for developers and users alike. Provide a sentence that begins with a verb like 'Fix', 'Improve', 'Enhance', or 'Optimize', and includes relevant details from the commit messages:\n[Git commits]\n${commitsText}`
      )

      const nextTag = this.getNextTag(latestTag)
      await this.createRelease(nextTag, message)
      console.log('Release done!!!')
    } catch (error) {
      throw new AiCommitError(`Failed to create release: ${error.message}`)
    }
  }

  async generateAICommit () {
    if (!this.gitOps.isInsideGitRepository()) {
      throw new AiCommitError('This is not a git repository 🙅‍♂️')
    }

    if (this.cliArgs.all) {
      await this.commitAllFiles()
    } else {
      await this.commitEachFile()
    }
  }

  async commitAllFiles () {
    try {
      const diff = this.gitOps.getStagedDiff(null, this.getGitDiffUnified())

      if (!diff) {
        throw new AiCommitError('No changes to commit. Try adding files with "git add ." and running this script again')
      }

      const commitMessage = await this.commitGenerator.generateSingleCommitAll(diff)

      if (!commitMessage) {
        throw new AiCommitError('Failed to generate commit message')
      }

      if (this.cliArgs.force) {
        this.gitOps.commit(commitMessage, '.')
        return
      }

      const answer = await this.promptUser('Do you want to continue?', true)
      if (!answer.continue) {
        throw new AiCommitError('Commit aborted by user')
      }

      this.gitOps.commit(commitMessage, '.')
    } catch (error) {
      throw new AiCommitError(`Failed to commit all files: ${error.message}`)
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
            const diff = this.gitOps.getStagedDiff(file, this.getGitDiffUnified())

            if (!diff) {
              throw new AiCommitError(`No diff found for file ${file}. Try adding files with "git add ." and running this script again`)
            }

            commitMessage = await this.commitGenerator.generateSingleCommit(diff)
            break
          }
        }

        if (!commitMessage) {
          throw new AiCommitError(`Failed to generate commit message for file ${file}`)
        }

        if (!this.cliArgs.force) {
          const answer = await this.promptUser(`Do you want to continue with commit for ${file}?`, true)
          if (!answer.continue) {
            throw new AiCommitError(`Commit aborted by user for file ${file}`)
          }
        }

        this.gitOps.commit(commitMessage, file)
      }
    } catch (error) {
      throw new AiCommitError(`Failed to commit files: ${error.message}`)
    }
  }

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
      throw new AiCommitError(`Failed to prompt user: ${error.message}`)
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
      if (!this.cliArgs.force) {
        console.log(tag, ' --> ', message)
        const { continue: shouldContinue } = await this.promptUser('Do you want to continue?', true)
        if (!shouldContinue) {
          throw new AiCommitError('Commit aborted by user 🙅‍♂️')
        }
      }
      this.gitOps.createReleaseTag(tag, message)
    } catch (error) {
      throw new AiCommitError(`Failed to create release: ${error.message}`)
    }
  }

  getGitDiffUnified () {
    return this.cliArgs.u || this.cliArgs.unified || this.config.unified
  }
}
