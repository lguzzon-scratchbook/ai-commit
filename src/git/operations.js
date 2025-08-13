import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, dirname, parse } from 'node:path'
import { cwd, chdir } from 'node:process'
import semver from 'semver'
import { GitError } from '../errors/index.js'
import { isValidGitRef, isValidUnifiedValue, isValidFilePath, escapeGitArg } from '../security/sanitizer.js'

export class GitOperations {
  static findGitRoot () {
    try {
      execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' })
    } catch {
      throw new GitError('You are not inside a Git repository.', null, { code: 3001 })
    }

    let currentDir = cwd()
    let gitRootFound = false

    while (currentDir !== parse(currentDir).root) {
      if (existsSync(join(currentDir, '.git'))) {
        chdir(currentDir)
        console.log(`Changed working directory to: ${currentDir}`)
        gitRootFound = true
        break
      }
      currentDir = dirname(currentDir)
    }

    if (!gitRootFound) {
      throw new GitError('Unable to find the root of the Git repository.', null, { code: 3001 })
    }

    return true
  }

  static isInsideGitRepository () {
    try {
      const output = execSync('git rev-parse --is-inside-work-tree', {
        encoding: 'utf-8'
      })
      return output.trim() === 'true'
    } catch (err) {
      return false
    }
  }

  static getLatestTag () {
    try {
      const tag = execSync('git describe --tags --abbrev=0').toString().trim()
      return semver.clean(tag)
    } catch (error) {
      return null
    }
  }

  static getLatestCommit (tag) {
    try {
      // Validate tag if provided
      if (tag && !isValidGitRef(tag)) {
        throw new GitError(`Invalid git tag: ${tag}`, null, { code: 3009 })
      }

      const range = tag ? `${tag}..HEAD` : 'HEAD'
      return execSync(`git log ${range} --pretty=format:%H | tail -1`)
        .toString()
        .trim()
    } catch (error) {
      throw new GitError(`Failed to get latest commit: ${error.message}`, null, { code: 3006 })
    }
  }

  static getCommitsText (since) {
    try {
      // Validate since parameter
      if (since && !isValidGitRef(since)) {
        throw new GitError(`Invalid git reference: ${since}`, null, { code: 3009 })
      }

      const range = since ? `${since}..HEAD` : 'HEAD'
      return execSync(`git log ${range} --pretty=format:%s`).toString().trim()
    } catch (error) {
      throw new GitError(`Failed to get commits text: ${error.message}`, null, { code: 3006 })
    }
  }

  static getStagedFiles () {
    try {
      const output = execSync('git diff --cached --name-status').toString().trim()
      return output?.split('\n') ?? []
    } catch (error) {
      throw new GitError(`Failed to get staged files: ${error.message}`, null, { code: 3007 })
    }
  }

  static getStagedDiff (file = null, unified = 1) {
    try {
      // Validate unified parameter
      if (!isValidUnifiedValue(unified)) {
        throw new GitError(`Invalid unified value: ${unified}`, null, { code: 3009 })
      }

      // Validate file parameter
      if (file && !isValidFilePath(file)) {
        throw new GitError(`Invalid file path: ${file}`, null, { code: 3009 })
      }

      const diffCommand = file
        ? `git diff -U${unified} --staged "${escapeGitArg(file)}"`
        : `git diff -U${unified} --staged`

      const output = execSync(diffCommand).toString().trim()
      return output
    } catch (error) {
      throw new GitError(`Failed to get staged diff: ${error.message}`, null, { code: 3005 })
    }
  }

  static commit (message, file = '.') {
    console.log('Committing Message... 🚀')
    try {
      // Validate file parameter
      if (!isValidFilePath(file)) {
        throw new GitError(`Invalid file path: ${file}`, null, { code: 3009 })
      }

      const escapedFile = escapeGitArg(file)
      execSync(`git commit "${escapedFile}" -F - `, { input: message })
      console.log('Commit Successful! 🎉')
      return true
    } catch (error) {
      throw new GitError(`Failed to commit: ${error.message}`, null, { code: 3003 })
    }
  }

  static createReleaseTag (tag, message) {
    try {
      // Validate tag and message parameters
      if (!isValidGitRef(tag)) {
        throw new GitError(`Invalid git tag: ${tag}`, null, { code: 3009 })
      }

      if (typeof message !== 'string' || message.length === 0) {
        throw new GitError('Message is required for release tag', null, { code: 3002 })
      }

      const escapedTag = escapeGitArg(tag)
      const escapedMessage = escapeGitArg(message)
      execSync(`git gfr "${escapedTag}" "${escapedMessage}" >/dev/null 2>&1`)
    } catch (error) {
      throw new GitError(`Failed to create release tag: ${error.message}`, null, { code: 3004 })
    }
  }
}
