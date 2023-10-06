'use strict'

import { execSync } from 'child_process'
import { ChatGPTAPI, ChatGPTUnofficialProxyAPI } from 'chatgpt'
import inquirer from 'inquirer'
import { getArguments, isInsideGitRepository } from './helpers.js'
import { filterApi } from './filterApi.js'
import semver from 'semver'
import * as dotenv from 'dotenv'

dotenv.config()
const gcArgs = getArguments()
const gcVerbose = gcArgs.v || gcArgs.verbose
// const gcDebug = gcArgs.d || gcArgs.debug
const gcApiKey = gcArgs.apiKey || process.env.OPENAI_API_KEY
const gcApiToken = process.env.OPENAI_ACCESS_TOKEN

if (!gcApiKey && !gcApiToken) {
  console.error('Please set the OPENAI_API_KEY or OPENAI_ACCESS_TOKEN environment variable.')
  process.exit(1)
}

const gcCompletionParams = {
  temperature: 0,
  top_p: 0.2
}

const gcApi = gcApiToken
  ? new ChatGPTUnofficialProxyAPI({
    accessToken: process.env.OPENAI_ACCESS_TOKEN,
    completionParams: gcCompletionParams
  })
  : new ChatGPTAPI({
    apiKey: gcApiKey,
    completionParams: gcCompletionParams
  })

if (gcApiToken) {
  console.log('Using: ApiToken')
} else {
  console.log('Using: ApiKey')
}

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
    const lcBeginTemplateTag = 'Begin-Template'
    const lcEndTemplateTag = 'End-Template'
    const lcBeginGitDiffTag = 'Begin-GitDiff'
    const lcEndGitDiffTag = 'End-GitDiff'
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
  }
}

async function mySendMessage (aMessage) {
  return gcApi.sendMessage(aMessage)
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
  const lReturn = (gcArgs.p || gcArgs.prompt || 'v03') + suffix
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
  const prompt = `Provide a release summary sentence that begins with an imperative verb and is less than 80 characters long, analyzing all the Git commits text from the previous release. Follows the Git commits text:\n${commitsText}`
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
  const { text } = await mySendMessage(prompt)
  return text.trim().replaceAll('"', '')
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
  // Get list of staged files with their status
  const stagedFiles = execSync('git diff --cached --name-status')
    .toString()
    .trim()
    .split('\n')

  // Loop through each staged file
  for (let i = 0; i < stagedFiles.length; i++) {
    const [status, file] = stagedFiles[i].trim().split('\t')

    // Print file being processed
    console.log('\nProcessing file ->', file)

    // Check if file exists
    if (file) {
      switch (status.trim().toUpperCase()) {
        case 'D':
          // Create commit for deleted file
          makeCommit(`chore(${file}): 🔧 - File deleted`, file)
          break

        default:
          {
            // Get diff for staged file
            const diff = execSync(
              `git diff -U${getGitDiffUnified()} --staged "${file}"`
            )
              .toString()
              .trim()

            // Handle empty diff
            if (!diff) {
              console.log('No changes to commit 🙅')
              console.log(
                'May be you forgot to add the files? Try git add . and then run this script again.'
              )
              process.exit(1)
            }

            // Generate commit message for file changes
            const commitMessage = await generateSingleCommit(diff)

            // Confirm commit creation if not forced
            if (!gcArgs.force) {
              const answer = await inquirer.prompt([
                {
                  type: 'confirm',
                  name: 'continue',
                  message: 'Do you want to continue?',
                  default: true
                }
              ])

              if (!answer.continue) {
                console.log('Commit aborted by user 🙅‍♂️')
                process.exit(1)
              }
            }

            // Create commit for file changes
            makeCommit(commitMessage, file)
          }
          break
      }
    }
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
  const lText = split90(text)
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
