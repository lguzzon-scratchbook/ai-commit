import { encode } from 'gpt-3-encoder'
import inquirer from 'inquirer'
import { ValidationError } from './src/errors/index.js'

const FEE_PER_1K_TOKENS = 0.02
const MAX_TOKENS = 12000
// this is the approximate cost of a completion (answer) fee from CHATGPT
const FEE_COMPLETION = 0.001

async function filterApi ({ prompt, numCompletion = 1, filterFee }) {
  if (!prompt || typeof prompt !== 'string') {
    throw new ValidationError('Prompt is required and must be a string', 'prompt')
  }

  if (typeof numCompletion !== 'number' || numCompletion < 1) {
    throw new ValidationError('Number of completions must be a positive number', 'numCompletion')
  }

  if (typeof filterFee !== 'boolean') {
    throw new ValidationError('Filter fee must be a boolean', 'filterFee')
  }

  try {
    const lcNumTokens = encode(prompt).length
    const lcFee = lcNumTokens / 1000 * FEE_PER_1K_TOKENS + (FEE_COMPLETION * numCompletion)

    if (lcNumTokens > MAX_TOKENS) {
      throw new ValidationError(`The commit diff is too large for the ChatGPT API. Max ${MAX_TOKENS} tokens or ~${MAX_TOKENS * 2} characters.`, 'prompt')
    }

    if (filterFee) {
      console.log(`This will cost you ~$${+lcFee.toFixed(3)} for using the API.`)
      const lcAnswer = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'continue',
          message: 'Do you want to continue 💸?',
          default: true
        }
      ])
      if (!lcAnswer.continue) return false
    }

    return true
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error
    }
    throw new ValidationError(`Failed to filter API request: ${error.message}`)
  }
};

export { filterApi }
