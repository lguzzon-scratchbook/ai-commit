#!/usr/bin/env node

'use strict'
import { execSync } from 'child_process'
import { ChatGPTAPI } from 'chatgpt'
import inquirer from 'inquirer'
import { getArgs, checkGitRepository } from './helpers.js'
import { filterApi } from './filterApi.js'

import * as dotenv from 'dotenv'
dotenv.config()

const args = getArgs()

const apiKey = args.apiKey || process.env.OPENAI_API_KEY
if (!apiKey) {
  console.error('Please set the OPENAI_API_KEY environment variable.')
  process.exit(1)
}

const api = new ChatGPTAPI({
  apiKey
})

const makeCommit = (input, lFilename) => {
  console.log('Committing Message... 🚀 ')
  execSync(`git commit "${lFilename}" -F - `, { input })
  console.log('Commit Successful! 🎉')
}

const prompts = {
  ok: function (aGitDiff) {
    return this.v01(aGitDiff)
  },
  oks: function (aGitDiff) { return this.v01s(aGitDiff) },
  v01: function (aGitDiff) {
    return [
      ...this.v01_head(aGitDiff),
      '- Ensure that the description is a list with all changes, updates, additions, and deletions made in the git diff in detail, using bullet points and nothing else!: <description>'
    ]
  },
  v01_head: function (aGitDiff) {
    return [
      'Please provide a conventional commit message following this template:',
      '<type>(scope): <gitmoji> <subject>',
      '',
      '<description>',
      '',
      'Given the following git diff:',
      aGitDiff,
      '',
      'Analyze the arguments of the given git diff using a hierarchical table of contents (at least 3 levels) and make sure to:',
      '- Select a type: <type>',
      '- If necessary, select a scope from files, directories, or topics: <scope>',
      '- Choose a gitmoji icon character  that corresponds to the <type> you selected: <gitmoji>',
      '- Ensure that the subject begins with an imperative verb and is no longer than 40 characters!: <subject>'
    ]
  },
  v01s: function (aGitDiff) {
    return [
      ...this.v01_head(aGitDiff),
      '- Ensure that the description is a list with all changes, updates, additions, and deletions made for each file in the git diff in detail, using bullet points and nothing else!: <description>'
    ]
  }
}

const generateSingleCommit = async (aGitDiff) => {
  const lPrompt = prompts.ok(aGitDiff).join('\n')
  if (!(await filterApi({ prompt: lPrompt, filterFee: args['filter-fee'] }))) { process.exit(1) }
  const lMessage = await api.sendMessage(lPrompt)
  const { text } = lMessage

  const lText = split90(text)
  console.log(
    `Proposed Commit: \n------------------------------\n${lText} \n------------------------------`
  )
  return lText
}

const generateSingleCommitAll = async (aGitDiff) => {
  const prompt = prompts.oks(aGitDiff).join('\n')
  if (!(await filterApi({ prompt, filterFee: args['filter-fee'] }))) { process.exit(1) }
  const lMessage = await api.sendMessage(prompt)
  const { text } = lMessage

  const lText = split90(text)
  console.log(
    `Proposed Commit: \n------------------------------\n${lText} \n------------------------------`
  )
  return lText
}

function split90 (text) {
  return text
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
  if (args.all) {
    await commitAllFiles()
  } else await commitEachFile()
}

await generateAICommit()

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

  if (args.force) {
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
  return args.u || args.unified || 1
}

async function commitEachFile () {
  const stagedFiles = execSync('git diff --cached --name-only')
    .toString()
    .trim()
    .split('\n')

  for (let lIndex = 0; lIndex < stagedFiles.length; lIndex++) {
    const lElement = stagedFiles[lIndex].trim()
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

      if (args.force) {
        makeCommit(lText, lElement)
        continue
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

      makeCommit(lText, lElement)
    }
  }
}
