import { execSync } from 'child_process'
import { ValidationError } from './src/errors/index.js'

const getArguments = () => {
  const lcArgs = process.argv.slice(2)
  const lcResult = {}

  for (let lIndex = 0; lIndex < lcArgs.length; lIndex++) {
    const lArg = lcArgs[lIndex]

    if (!lArg.startsWith('--')) {
      throw new ValidationError(`Invalid argument format: ${lArg}. Arguments must start with '--'`, 'arguments')
    }

    const lKey = lArg.replace(/^--/, '')
    const lNextArg = lcArgs[lIndex + 1]

    if (/^--/.test(lNextArg) || lNextArg === undefined) {
      lcResult[lKey] = true
    } else {
      lcResult[lKey] = lNextArg
      lIndex++
    }
  }

  return lcResult
}

const isInsideGitRepository = () => {
  try {
    const lOutput = execSync('git rev-parse --is-inside-work-tree', {
      encoding: 'utf-8'
    })
    return lOutput.trim() === 'true'
  } catch (err) {
    return false
  }
}

export { getArguments, isInsideGitRepository }
