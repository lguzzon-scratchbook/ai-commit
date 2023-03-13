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

const REGENERATE_MSG = '♻️ Regenerate Commit Messages'

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
  execSync('git commit "' + lFilename + '" -F - ', { input })
  console.log('Commit Successful! 🎉')
}

const generateSingleCommit = async (diff) => {
  const prompt = [
    'I want you to act as the author of a commit message in git.',
    "I'll enter a git diff, and your job is to convert it into a useful commit message,",
    'using the conventional commits specification (<type>(<scope>): <gitmoji><subject><body>).',
    'type must be lowercase.',
    'scope is optional based on file in diff.',
    'gitmoji is a gitmoji string bases on type.',
    'subject is only a summary line based on file in diff and must be at maximum 50 chars long.',
    'body is a markdown bullet list of details on changes and every line must be at maximum 100 chars long.',
    diff
  ].join('\n')

  if (!(await filterApi({ prompt, filterFee: args['filter-fee'] }))) { process.exit(1) }

  const { text } = await api.sendMessage(prompt)

  // const lText = text.split('. ').join('.\n')
  const lText = text

  console.log(
    `Proposed Commit:\n------------------------------\n${lText}\n------------------------------`
  )
  return lText
}

const generateListCommits = async (diff, numOptions = 5) => {
  const prompt =
    'I want you to act as the author of a commit message in git.' +
    `I'll enter a git diff, and your job is to convert it into a useful commit message and make ${numOptions} options that are separated by ";;;".` +
    'For each option' +
    'Do not preface the commit message with anything, use the present tense, return the full sentence.' +
    'Use the conventional commits specification (<type>(<scope>): <gitmoji><subject>).' +
    'type section must be lowercase and selected analysing subject section.' +
    'scope section is optional and selected analysing context.' +
    'gitmoji section collect one or more gitmoji you select analysing subject section.' +
    'subject section first line must be at maximun 50 chars long:' +
    diff

  if (
    !(await filterApi({
      prompt,
      filterFee: args['filter-fee'],
      numCompletion: numOptions
    }))
  ) { process.exit(1) }

  const { text } = await api.sendMessage(prompt)

  const msgs = text.split(';;;')

  // add regenerate option
  msgs.push(REGENERATE_MSG)

  const answer = await inquirer.prompt([
    {
      type: 'list',
      name: 'commit',
      message: 'Select a commit message',
      choices: msgs
    }
  ])

  if (answer.commit === REGENERATE_MSG) {
    await generateListCommits(diff)
    return
  }

  makeCommit(answer.commit)
}

async function generateAICommit () {
  const isGitRepository = checkGitRepository()

  if (!isGitRepository) {
    console.error('This is not a git repository 🙅‍♂️')
    process.exit(1)
  }

  const stagedFiles = execSync('git diff --cached --name-only')
    .toString()
    .trim()
    .split('\n')

  for (let lIndex = 0; lIndex < stagedFiles.length; lIndex++) {
    const lElement = stagedFiles[lIndex]

    const diff = execSync('git diff --staged "' + lElement + '"')
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

    const lText = args.list
      ? await generateListCommits(diff)
      : await generateSingleCommit(diff)

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

await generateAICommit()
