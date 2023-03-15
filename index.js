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
  execSync('git commit "' + lFilename + '" -F - ', { input })
  console.log('Commit Successful! 🎉')
}

const generateSingleCommit = async (diff) => {
  const prompt = [
    'Generate git commit message based on the following git diff:',
    diff,
    'Use the conventional commit message format to respond:',
    '+++',
    '<type>(<scope>): <gitmoji> <subject>',
    '',
    '<long_description>',
    '+++',
    'Provide a type for the changes you observed in the given git diff: <type>',
    'Provide a scope for the changes you observed in the given git diff (e.g. file, directory, topic): <scope>',
    'Provide a gitmoji text that best represents the <type>: <gitmoji>',
    'Provide a subject for the changes you observed in the given git diff (40 characters or less): <subject>',
    'Provide a detailed explanation of the changes made in the given git diff, do not include anything more than what is required: <long_description>'
  ].join('\n')
  if (!(await filterApi({ prompt, filterFee: args['filter-fee'] }))) { process.exit(1) }
  const lMessagge = await api.sendMessage(prompt)
  const { text } = lMessagge

  const lText = split90(text)
  console.log(
    `Proposed Commit: \n------------------------------\n${lText} \n------------------------------`
  )
  return lText
}

const generateSingleCommitAll = async (diff) => {
  const prompt = [
    'Generate git commit message based on the following git diff:',
    diff,
    'Use the conventional commit message format to respond:',
    '+++',
    '<type>(<scope>): <gitmoji> <subject>',
    '',
    '<long_description>',
    '+++',
    'Provide a type for the changes you observed in the given git diff: <type>',
    'Provide a scope for the changes you observed in the given git diff (e.g. file, directory, topic): <scope>',
    'Provide a gitmoji text that best represents the <type>: <gitmoji>',
    'Provide a subject for the changes you observed in the given git diff (40 characters or less): <subject>',
    'Provide a detailed explanation of the changes made in the given git diff, do not include anything more than what is required: <long_description>'
  ].join('\n')
  if (!(await filterApi({ prompt, filterFee: args['filter-fee'] }))) { process.exit(1) }
  const lMessagge = await api.sendMessage(prompt)
  const { text } = lMessagge

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
            '  ' + lCurrent.substring(lSplitIndexStart, lSplitIndex)
          )
        } else {
          aPrevious.push(lCurrent.substring(lSplitIndexStart, lSplitIndex))
        }
        lSplitIndexStart = lSplitIndex
        lSplitIndex += 90
      }
      if (lSplitIndex > 90) {
        aPrevious.push('  ' + lCurrent.substring(lSplitIndexStart))
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
  const diff = execSync('git diff -U0 --staged').toString().trim()

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

async function commitEachFile () {
  const stagedFiles = execSync('git diff --cached --name-only')
    .toString()
    .trim()
    .split('\n')

  for (let lIndex = 0; lIndex < stagedFiles.length; lIndex++) {
    const lElement = stagedFiles[lIndex].trim()
    if (lElement) {
      const diff = execSync('git diff -U0 --staged "' + lElement + '"')
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
