'use strict'

import { AiCommitApp } from './src/app.js'

async function main () {
  const app = new AiCommitApp()
  await app.run()
}

export { main }
