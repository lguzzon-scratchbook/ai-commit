import { encode } from 'gpt-3-encoder'
import inquirer from 'inquirer'

const FEE_PER_1K_TOKENS = 0.02
const MAX_TOKENS = 12000
// this is the approximate cost of a completion (answer) fee from CHATGPT
const FEE_COMPLETION = 0.001

async function filterApi ({ prompt, numCompletion = 1, filterFee }) {
  const lcNumTokens = encode(prompt).length
  const lcFee = lcNumTokens / 1000 * FEE_PER_1K_TOKENS + (FEE_COMPLETION * numCompletion)

  if (lcNumTokens > MAX_TOKENS) {
    console.log('The commit diff is too large for the ChatGPT API. Max 4k tokens or ~8k characters. ')
    return false
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
};

export { filterApi }
