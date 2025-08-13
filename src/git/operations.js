import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, dirname, parse } from 'node:path'
import { cwd, chdir } from 'node:process'
import semver from 'semver'
import { GitError } from '../errors/index.js'

export class GitOperations {
  static findGitRoot () {
    try {
      execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' })
    } catch {
      throw new GitError('You are not inside a Git repository.')
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
      throw new GitError('Unable to find the root of the Git repository.')
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
      return execSync(`git log ${tag ? tag + '..' : ''}HEAD --pretty=format:%H | tail -1`)
        .toString()
        .trim()
    } catch (error) {
      throw new GitError(`Failed to get latest commit: ${error.message}`, 'git log')
    }
  }

  static getCommitsText (since) {
    try {
      return execSync(`git log ${since}..HEAD --pretty=format:%s`).toString().trim()
    } catch (error) {
      throw new GitError(`Failed to get commits text: ${error.message}`, 'git log')
    }
  }

  static getStagedFiles () {
    try {
      const output = execSync('git diff --cached --name-status').toString().trim()
      return output ? output.split('\n') : []
    } catch (error) {
      throw new GitError(`Failed to get staged files: ${error.message}`, 'git diff')
    }
  }

  static getStagedDiff (file = null, unified = 1) {
    try {
      const diffCommand = `git diff -U${unified} --staged ${file ? `"${file}"` : ''}`
      const output = execSync(diffCommand).toString().trim()
      return output
    } catch (error) {
      throw new GitError(`Failed to get staged diff: ${error.message}`, 'git diff')
    }
  }

  static commit (message, file = '.') {
    console.log('Committing Message... 🚀')
    try {
      execSync(`git commit "${file}" -F - `, { input: message })
      console.log('Commit Successful! 🎉')
      return true
    } catch (error) {
      throw new GitError(`Failed to commit: ${error.message}`, 'git commit')
    }
  }

  static createReleaseTag (tag, message) {
    try {
      execSync(`git gfr "${tag}" "${message}" >/dev/null 2>&1`)
    } catch (error) {
      throw new GitError(`Failed to create release tag: ${error.message}`, 'git gfr')
    }
  }
}
