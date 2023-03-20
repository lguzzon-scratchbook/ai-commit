'use strict'

import { execSync } from 'child_process'
import { ChatGPTAPI, ChatGPTUnofficialProxyAPI } from 'chatgpt'
import inquirer from 'inquirer'
import { getArgs, checkGitRepository } from './helpers.js'
import { filterApi } from './filterApi.js'
import semver from 'semver'
import * as dotenv from 'dotenv'

dotenv.config()
const gcArgs = getArgs()
const gcVerbose = gcArgs.v || gcArgs.verbose
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

export async function main () {
  if (gcVerbose) { console.info('ai-commit begin') }
  if (gcArgs.r || gcArgs.release) {
    await commitRelease()
  } else {
    await generateAICommit()
  }
  if (gcVerbose) { console.info('ai-commit end') }
}

function getOKProp (aSuffix = '') {
  let lResult = 'v03'
  const lPromptProp = gcArgs.p || gcArgs.prompt
  if (lPromptProp) {
    lResult = lPromptProp
  }
  lResult += aSuffix
  console.warn('Using prompt -> ', lResult)
  return lResult
}

function separator (aText) {
  return '-'.repeat(7) + aText + '-'.repeat(7)
}

async function commitRelease () {
  let latestTag = null
  try {
    latestTag = semver.clean(execSync('git describe --tags --abbrev=0 HEAD^')
      .toString()
      .trim())
  } catch (error) {
    latestTag = null
  }
  const lNextTag = latestTag ? semver.inc(latestTag, 'patch') : '0.0.0'
  const lLatestCommit = execSync(`git log ${latestTag}..HEAD --pretty=format:%H | tail -1`)
    .toString()
    .trim()
  if (!lLatestCommit) {
    console.log('No latest commit present ...')
    return
  }
  const commitsText = execSync(`git log ${lLatestCommit}..HEAD --pretty=format:%s`)
    .toString()
    .trim()
  const lPrompt = `Provide a release summary sentence that begins with an imperative verb and is less than 80 characters long, analyzing all the Git commits text from the previous release. Follows the Git commits text:\n${commitsText}`
  console.log('Release get summary ...')
  const lMessage = (await gcApi.sendMessage(lPrompt)).text.trim().replaceAll('"', '')
  console.log('Release Tag -> ', lNextTag, ' Msg => [', lMessage, ']')
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
  execSync(`git gfr "${lNextTag}" "${lMessage}" >/dev/null 2>&1`)
  console.log('Release done!!!')
}

async function commitAllFiles () {
  const lDiff = execSync(`git diff -U${getGitDiffUnified()} --staged`)

  // Handle empty diff
  if (!lDiff) {
    console.log('No changes to commit 🙅')
    console.log(
      'May be you forgot to add the files? Try git add . and then run this script again.'
    )
    process.exit(1)
  }

  const lText = await generateSingleCommitAll(lDiff)

  if (gcArgs.force) {
    makeCommit(lText, '.')
    return
  }

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

  makeCommit(lText, '.')
}

function getGitDiffUnified () {
  return gcArgs.u || gcArgs.unified || 1
}

async function commitEachFile () {
  const stagedFiles = execSync('git diff --cached --name-status')
    .toString()
    .trim()
    .split('\n')

  for (let lIndex = 0; lIndex < stagedFiles.length; lIndex++) {
    const [lStatus, lElement] = stagedFiles[lIndex].trim().split('\t')

    console.log('\nProcessing file -> ', lElement)
    if (lElement) {
      switch (lStatus.trim().toUpperCase()) {
        case 'D':
          makeCommit(`chore(${lElement}): 🔧 - File deleted`, lElement)
          break

        default:
          {
            const diff = execSync(
              `git diff -U${getGitDiffUnified()} --staged "${lElement}"`
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

            const lText = await generateSingleCommit(diff)

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

            makeCommit(lText, lElement)
          }
          break
      }
    }
  }
}

function makeCommit (aInput, aFilename) {
  console.log('Committing Message... 🚀 ')
  execSync(`git commit "${aFilename}" -F - `, { input: aInput })
  console.log('Commit Successful! 🎉')
}

async function generateSingleCommit (aGitDiff) {
  const lPrompt = prompts.ok(aGitDiff).join('\n')
  if (gcVerbose) { console.info(`Prompt text -> \n${lPrompt}\n`) }
  if (!(await filterApi({ prompt: lPrompt, filterFee: gcArgs['filter-fee'] }))) { process.exit(1) }
  console.log('Commit get message ...')
  const lMessage = await gcApi.sendMessage(lPrompt)
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
  const lMessage = await gcApi.sendMessage(lPrompt)
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
    .reduce((aPrevious, aCurrent) => {
      const lCurrent = aCurrent.trim()
      let lSplitIndexStart = 0
      let lSplitIndex = 90
      while (lCurrent.length >= lSplitIndex) {
        while (lCurrent[lSplitIndex] !== ' ') { lSplitIndex -= 1 }
        if (lSplitIndex > 90) {
          aPrevious.push(
            `  ${lCurrent.substring(lSplitIndexStart, lSplitIndex)}`
          )
        } else {
          aPrevious.push(lCurrent.substring(lSplitIndexStart, lSplitIndex))
        }
        lSplitIndexStart = lSplitIndex
        lSplitIndex += 90
      }
      if (lSplitIndex > 90) {
        aPrevious.push(`  ${lCurrent.substring(lSplitIndexStart)}`)
      } else { aPrevious.push(lCurrent) }
      return aPrevious
    }, []).join('\n')
}

async function generateAICommit () {
  const isGitRepository = checkGitRepository()

  if (!isGitRepository) {
    console.error('This is not a git repository 🙅‍♂️')
    process.exit(1)
  }
  if (gcArgs.all) {
    await commitAllFiles()
  } else { await commitEachFile() }
}
