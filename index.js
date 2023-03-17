#!/usr/bin/env node

'use strict'
import { execSync } from 'child_process'
import { ChatGPTAPI } from 'chatgpt'
import inquirer from 'inquirer'
import { getArgs, checkGitRepository } from './helpers.js'
import { filterApi } from './filterApi.js'

import semver from 'semver'

import * as dotenv from 'dotenv'
dotenv.config()

const gcArgs = getArgs()

const gcVerbose = gcArgs.v || gcArgs.verbose

const gcApiKey = gcArgs.apiKey || process.env.OPENAI_API_KEY
if (!gcApiKey) {
  console.error('Please set the OPENAI_API_KEY environment variable.')
  process.exit(1)
}

const gcApi = new ChatGPTAPI({
  apiKey: gcApiKey
})

const prompts = {
  ok: function (aGitDiff) {
    return this[getOKProp('')](aGitDiff)
  },
  oks: function (aGitDiff) { return this[getOKProp('s')](aGitDiff) },
  v01: function (aGitDiff) {
    return [
      ...this.v01_head(aGitDiff),
      '- Ensure that the description is a list with all changes, updates, additions, and deletions made in the git diff in detail, using bullet points and nothing else!: <description>'
    ]
  },
  v01s: function (aGitDiff) {
    return [
      ...this.v01_head(aGitDiff),
      '- Ensure that the description is a list with all changes, updates, additions, and deletions made for each file in the git diff in detail, using bullet points and nothing else!: <description>'
    ]
  },
  v01_head: function (aGitDiff) {
    return [
      'Please provide a conventional commit message following this template:',
      '<type>(scope): <gitmoji> <subject>',
      '',
      '<description>',
      '',
      '',
      'Given the following git diff:',
      aGitDiff,
      '',
      '',
      'Analyze the git diff and make sure to:',
      '- Select a type: <type>',
      '- If necessary, select a scope from files, directories, or topics: <scope>',
      '- Choose a gitmoji icon character  that corresponds to the <type> you selected: <gitmoji>',
      '- Ensure that the subject begins with an imperative verb and is no longer than 40 characters!: <subject>'
    ]
  },
  v02: function (aGitDiff) {
    return [
      ...this.v02_head(aGitDiff),
      '- Ensure that the description is a list with all changes, updates, additions, and deletions made in the git diff in detail, using bullet points and nothing else!: <description>'
    ]
  },
  v02s: function (aGitDiff) {
    return [
      ...this.v02_head(aGitDiff),
      '- Ensure that the description is a list with all changes, updates, additions, and deletions made for each file in the git diff in detail, using bullet points and nothing else!: <description>'
    ]
  },
  v02_head: function (aGitDiff) {
    return [
      'Please provide a conventional commit message following this template:',
      '<type>(scope): <gitmoji> - <subject>',
      '',
      '<description>',
      '',
      '',
      'Given the following git diff:',
      aGitDiff,
      '',
      '',
      'Analyze the given git diff and make sure to:',
      '- Identify the type of changes made in the diff, such as `feat`, `fix`, `docs`, `style`, `refactor`, `test`, or `chore`: <type>',
      '- If necessary, select a scope from files, directories, or topics: <scope>',
      '- Choose a gitmoji icon character that corresponds to the type of changes made in the diff, such as 🚀 for `feat`, 🐛 for `fix`, 📝 for `docs`, 🎨 for `style`, ♻️ for `refactor`, 🧪 for `test`, or 🔧 for `chore`: <gitmoji>',
      '- Ensure that the subject begins with an imperative verb and is no longer than 40 characters: <subject>'
    ]
  },
  v03: function (aGitDiff) {
    return [
      ...this.v03_head(aGitDiff),
      '- List all changes, updates, additions, and deletions made in the git diff in detail using bullet points in the description and include nothing else!: <description>'
    ]
  },
  v03s: function (aGitDiff) {
    return [
      ...this.v03_head(aGitDiff),
      '- Ensure, using bullet points, to list all changes, updates, additions, and deletions made in the git diff in detail and include nothing else: <description>'
    ]
  },
  v03_head: function (aGitDiff) {
    return [
      'Please provide a conventional commit message following this template:',
      `${separator('Begin-Tem' + 'plate')}`,
      '<type>(scope): <gitmoji> - <subject>',
      '',
      '<description>',
      `${separator('End-Temp' + 'late')}`,
      'Given the following git diff:',
      `${separator('Begin' + '-GitDiff')}`,
      aGitDiff,
      `${separator('En' + 'd-GitDiff')}`,
      'Analyze the given git diff and make sure to:',
      '- Identify the type of changes made in the diff, such as `feat`, `fix`, `docs`, `style`, `refactor`, `test`, or `chore`: <type>',
      '- If necessary, select a scope from files, directories, or topics: <scope>',
      '- Choose a gitmoji icon character that corresponds to the type of changes made in the diff, such as 🚀 for `feat`, 🐛 for `fix`, 📝 for `docs`, 🎨 for `style`, ♻️ for `refactor`, 🧪 for `test`, or 🔧 for `chore`: <gitmoji>',
      '- Ensure that the subject begins with an imperative verb and is no longer than 40 characters: <subject>'
    ]
  }
}

function getOKProp (aSuffix = '') {
  let lResult = 'v02'
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

if (gcArgs.r || gcArgs.release) { commitRelease() } else {
  await generateAICommit()
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
  const commitsText = execSync(`git log ${lLatestCommit}..HEAD --pretty=format:%s`)
    .toString()
    .trim()
  console.log('Release get summary ...')
  const lPrompt = `Please provide a release summary sentence that begins with an imperative verb and is less than 80 characters long, analyzing all the Git commit text from the previous release. The commits text is as follows:\n${commitsText}`
  const lMessage = (await gcApi.sendMessage(lPrompt)).text.trim()
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
  execSync(`git gfr "${lNextTag}" "${lMessage}"`)
}

async function commitAllFiles () {
  const diff = execSync(`git diff -U${getGitDiffUnified()} --staged`).toString().trim()

  // Handle empty diff
  if (!diff) {
    console.log('No changes to commit 🙅')
    console.log(
      'May be you forgot to add the files? Try git add . and then run this script again.'
    )
    process.exit(1)
  }

  const lText = await generateSingleCommitAll(diff)

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
  const stagedFiles = execSync('git diff --cached --name-only')
    .toString()
    .trim()
    .split('\n')

  for (let lIndex = 0; lIndex < stagedFiles.length; lIndex++) {
    const lElement = stagedFiles[lIndex].trim()
    console.log('Processing file -> ', lElement)
    if (lElement) {
      const diff = execSync(`git diff -U${getGitDiffUnified()} --staged "${lElement}"`)
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
  const lMessage = await gcApi.sendMessage(lPrompt)
  const { text } = lMessage

  const lText = split90(text)
  console.log(
    `Proposed Commit: \n------------------------------\n${lText} \n------------------------------`
  )
  return lText
}

async function generateSingleCommitAll (aGitDiff) {
  const prompt = prompts.oks(aGitDiff).join('\n')
  if (!(await filterApi({ prompt, filterFee: gcArgs['filter-fee'] }))) { process.exit(1) }
  const lMessage = await gcApi.sendMessage(prompt)
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
  } else await commitEachFile()
}
