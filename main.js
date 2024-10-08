'use strict'

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, dirname, parse } from 'node:path'
import { cwd, chdir } from 'node:process'
import inquirer from 'inquirer'
import { getArguments, isInsideGitRepository } from './helpers.js'
import { filterApi } from './filterApi.js'
import semver from 'semver'
import * as dotenv from 'dotenv'

dotenv.config()
const gcArgs = getArguments()
const gcVerbose = gcArgs.v || gcArgs.verbose
// const gcDebug = gcArgs.d || gcArgs.debug
const gcApiKey = gcArgs.apiKey || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY

const lcBeginTemplateTag = 'Begin-Template'
const lcEndTemplateTag = 'End-Template'
const lcBeginGitDiffTag = 'Begin-GitDiff'
const lcEndGitDiffTag = 'End-GitDiff'

if (!findGitRoot()) {
  process.exit(1)
}

if (!gcApiKey) {
  console.error('Please set the OPENAI_API_KEY or OPENAI_ACCESS_TOKEN environment variable.')
  process.exit(1)
}

const gcApi = message => fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${gcApiKey}`,
    'HTTP-Referer': 'https://ai-commit.lucaguzzon.com', // Optional, for including your app on openrouter.ai rankings.
    'X-Title': 'ai-commit', // Optional. Shows in rankings on openrouter.ai.
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    // model: 'openrouter/auto',
    // model: 'openai/gpt-3.5-turbo',
    model: 'openai/gpt-4o-mini',
    temperature: 0,
    top_p: 0.2,
    messages: [
      { role: 'user', content: message }
    ]
  })
})

const prompts = {
  ok: function (aGitDiff) {
    return this[getOKProp('')](aGitDiff)
  },
  oks: function (aGitDiff) { return this[getOKProp('s')](aGitDiff) },
  v03: function (aGitDiff) {
    return [
      ...this.v03_head(aGitDiff),
      '- Ensure, using bullet points, to list all changes, updates, additions, and deletions made in the git diff in detail and include nothing else: <description>'
    ]
  },
  v03s: function (aGitDiff) {
    return [
      ...this.v03_head(aGitDiff),
      '- Ensure that the description is a list with all changes, updates, additions, and deletions made for each file in the git diff in detail, using bullet points and nothing else!: <description>'
    ]
  },
  v03_head: function (aGitDiff) {
    return [
      'Please provide a conventional commit message following this template:',
      `${separator(lcBeginTemplateTag)}`,
      '<type>(scope): <gitmoji> - <subject>',
      '',
      '<description>',
      `${separator(lcEndTemplateTag)}`,
      'Given the following git diff:',
      `${separator(lcBeginGitDiffTag)}`,
      aGitDiff,
      `${separator(lcEndGitDiffTag)}`,
      'Remember that the goal of a commit message is to provide a clear and concise summary of the changes made, which will be helpful for future developers who are working on the project.',
      'Analyze the given git diff and make sure to:',
      '- Identify the type of changes made in the diff, such as `feat`, `fix`, `docs`, `style`, `refactor`, `test`, or `chore`: <type>',
      '- If necessary, select a scope from files, directories, or topics: <scope>',
      '- Choose a gitmoji icon character that corresponds to the type of changes made in the diff, such as 🚀 for `feat`, 🐛 for `fix`, 📝 for `docs`, 🎨 for `style`, ♻️ for `refactor`, 🧪 for `test`, or 🔧 for `chore`: <gitmoji>',
      '- Ensure that the subject begins with an imperative verb and is no longer than 40 characters: <subject>'
    ]
  },
  v04: function (aGitDiff) {
    return [
      ...this.v04_head(aGitDiff),
      '- Ensure, using bullet points, to list all changes, updates, additions, and deletions made in the git diff in detail and include nothing else: <description>'
    ]
  },
  v04s: function (aGitDiff) {
    return [
      ...this.v04_head(aGitDiff),
      '- Ensure that the description is a list with all changes, updates, additions, and deletions made for each file in the git diff in detail, using bullet points and nothing else!: <description>'
    ]
  },
  v04_head: function (aGitDiff) {
    return [
      'Please provide a conventional commit message following this [template]:',
      '[template]=\'\'\'',
      '<type>(scope): <gitmoji> - <subject>',
      '',
      '<description>',
      '\'\'\'',
      'Given the following [git diff]:',
      '[git diff]=\'\'\'',
      aGitDiff,
      '\'\'\'',
      'Remember that the goal of a commit message is to provide a clear and concise summary of the changes made, which will be helpful for future developers who are working on the project.',
      'Analyze the given git diff and make sure to:',
      '- Identify the type of changes made in the diff, such as `feat`, `fix`, `docs`, `style`, `refactor`, `test`, or `chore`: <type>',
      '- If necessary, select a scope from files, directories, or topics: <scope>',
      '- Choose a gitmoji icon character that corresponds to the type of changes made in the diff, such as 🚀 for `feat`, 🐛 for `fix`, 📝 for `docs`, 🎨 for `style`, ♻️ for `refactor`, 🧪 for `test`, or 🔧 for `chore`: <gitmoji>',
      '- Ensure that the subject begins with an imperative verb and is no longer than 40 characters: <subject>'
    ]
  }
}

async function mySendMessage (aMessage) {
  const lResponse = await gcApi(aMessage)
  const lJson = await lResponse.json()
  return { text: lJson.choices[0].message.content.replace(`${separator(lcBeginTemplateTag)}`, '').replace(`${separator(lcEndTemplateTag)}`, '') }
}

export async function main () {
  const isVerbose = gcVerbose
  const isRelease = gcArgs.r || gcArgs.release

  if (isVerbose) console.info('ai-commit begin')

  if (isRelease) {
    await commitRelease()
  } else {
    await generateAICommit()
  }

  if (isVerbose) console.info('ai-commit end')

  return Promise.resolve()
}

function getOKProp (suffix = '') {
  const lReturn = (gcArgs.p || gcArgs.prompt || 'v04') + suffix
  console.warn('Using prompt -> ', lReturn)
  return lReturn
}

function separator (aText) {
  return `${'-'.repeat(7)}${aText}${'-'.repeat(7)}`
}

async function commitRelease () {
  // Get the latest tag and latest commit hash
  const latestTag = getLatestTag()
  const latestCommit = getLatestCommit(latestTag)

  // If there are no new commits, exit
  if (!latestCommit) {
    console.log('No new commits since last release')
    return
  }

  // Get commit messages and prompt user for release summary
  const commitsText = getCommitsText(latestCommit)
  const prompt = `Craft a concise, imperative sentence (less than 80 characters) that distills the essence of the previous release, based on a thorough analysis of the Git commit messages. What key features, bug fixes, or improvements can be highlighted in a single, action-oriented statement? Consider the tone and style of the sentence, ensuring it's clear, concise, and engaging for developers and users alike. Provide a sentence that begins with a verb like 'Fix', 'Improve', 'Enhance', or 'Optimize', and includes relevant details from the commit messages:\n[Git commits]\n${commitsText}`
  const message = await promptUser(prompt)

  // Create new tag and release
  const nextTag = getNextTag(latestTag)
  await createRelease(nextTag, message)
  console.log('Release done!!!')
}

function getLatestTag () {
  try {
    return semver.clean(
      execSync('git describe --tags --abbrev=0').toString().trim()
    )
  } catch (error) {
    return null
  }
}

function getLatestCommit (tag) {
  return execSync(`git log ${tag ? tag + '..' : ''}HEAD --pretty=format:%H | tail -1`)
    .toString()
    .trim()
}

function getCommitsText (since) {
  return execSync(`git log ${since}..HEAD --pretty=format:%s`).toString().trim()
}

async function promptUser (prompt) {
  console.log('Getting release summary ...')
  if (gcVerbose) {
    console.info(`Prompt text -> \n${prompt}\n`)
  }
  const { text } = await mySendMessage(prompt)
  return text.replaceAll('"', '').replaceAll('```\n', '').replaceAll('\n```', '').trim()
}

function getNextTag (tag) {
  return tag ? semver.inc(tag, 'patch') : '0.0.0'
}

async function createRelease (tag, message) {
  if (!gcArgs.force) {
    console.log(tag, ' --> ', message)
    const { continue: shouldContinue } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'continue',
        message: 'Do you want to continue?',
        default: true
      }
    ])
    if (!shouldContinue) {
      console.log('Commit aborted by user 🙅‍♂️')
      process.exit(1)
    }
  }
  execSync(`git gfr "${tag}" "${message}" >/dev/null 2>&1`)
}

async function commitAllFiles () {
  const diffCommand = `git diff -U${getGitDiffUnified()} --staged`
  const diff = execSync(diffCommand)

  if (!diff) {
    console.log('No changes to commit')
    console.log('Try adding files with "git add ." and running this script again')
    process.exit(1)
  }

  const commitMessage = await generateSingleCommitAll(diff)

  if (gcArgs.force) {
    makeCommit(commitMessage, '.')
    return
  }

  const answer = await inquirer.prompt({
    type: 'confirm',
    name: 'continue',
    message: 'Do you want to continue?',
    default: true
  })

  if (!answer.continue) {
    console.log('Commit aborted by user')
    process.exit(1)
  }

  makeCommit(commitMessage, '.')
}

// Returns the number of unified diff lines to show in git.
function getGitDiffUnified () {
  const unifiedArg = gcArgs.u || gcArgs.unified || 1
  return unifiedArg
}

async function commitEachFile () {
  const stagedFiles = execSync('git diff --cached --name-status')
    .toString()
    .trim()
    .split('\n')

  for (const fileStatus of stagedFiles) {
    const [status, file] = fileStatus.trim().split('\t')

    if (!file) {
      continue
    }

    let commitMessage

    switch (status.trim().toUpperCase()) {
      case 'D':{
        commitMessage = `chore(${file}):  - File deleted`
        break }

      default:{
        const diff = execSync(
          `git diff -U${getGitDiffUnified()} --staged "${file}"`
        )
          .toString()
          .trim()

        if (!diff) {
          console.log('May be you forgot to add the files? Try git add . and then run this script again.')
          process.exit(1)
        }

        commitMessage = await generateSingleCommit(diff) }
    }

    if (!gcArgs.force) {
      const { continue: shouldContinue } = await inquirer.prompt({
        type: 'confirm',
        name: 'continue',
        message: 'Do you want to continue?',
        default: true
      })

      if (!shouldContinue) {
        console.log('Commit aborted by user ')
        process.exit(1)
      }
    }

    makeCommit(commitMessage, file)
  }
}

function makeCommit (aInput, aFilename) {
  console.log('Committing Message... 🚀')
  try {
    execSync(`git commit "${aFilename}" -F - `, { input: aInput })
    console.log('Commit Successful! 🎉')
  } catch (error) {
    console.error('Error committing message:', error)
  }
}

async function generateSingleCommit (aGitDiff) {
  const lPrompt = prompts.ok(aGitDiff).join('\n')
  if (gcVerbose) { console.info(`Prompt text -> \n${lPrompt}\n`) }
  if (!(await filterApi({ prompt: lPrompt, filterFee: gcArgs['filter-fee'] }))) { process.exit(1) }
  console.log('Commit get message ...')
  const lMessage = await mySendMessage(lPrompt)
  const { text } = lMessage
  const lText = split90(text).replaceAll('```\n', '').replaceAll('\n```', '').trim()
  console.log(
    `Proposed Commit: \n------------------------------\n${lText} \n------------------------------`
  )
  return lText
}

async function generateSingleCommitAll (aGitDiff) {
  const lPrompt = prompts.oks(aGitDiff).join('\n')
  if (gcVerbose) { console.info(`Prompt text -> \n${lPrompt}\n`) }
  if (!(await filterApi({ prompt: lPrompt, filterFee: gcArgs['filter-fee'] }))) { process.exit(1) }
  console.log('Commit all get message ...')
  const lMessage = await mySendMessage(lPrompt)
  const { text } = lMessage
  const lText = split90(text)
  console.log(
    `Proposed Commit: \n------------------------------\n${lText} \n------------------------------`
  )
  return lText
}

function split90 (aText) {
  return aText
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

async function generateAICommit () {
  const isGitRepository = isInsideGitRepository()

  if (!isGitRepository) {
    console.error('This is not a git repository 🙅‍♂️')
    process.exit(1)
  }
  if (gcArgs.all) {
    await commitAllFiles()
  } else { await commitEachFile() }
}

function findGitRoot () {
  // Check if current directory is in a Git repository
  try {
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' })
  } catch {
    console.log('You are not inside a Git repository.')
    return false
  }

  // If we're here, we're in a Git repository
  let currentDir = cwd()

  while (currentDir !== parse(currentDir).root) {
    if (existsSync(join(currentDir, '.git'))) {
      chdir(currentDir)
      console.log(`Changed working directory to: ${currentDir}`)
      return true
    }
    currentDir = dirname(currentDir)
  }

  // This should not be reached if we're in a Git repo, but just in case
  console.log('Error: Unable to find the root of the Git repository.')
  return false
}
