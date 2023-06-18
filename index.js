#!/usr/bin/env node

'use strict'

import { main } from './main.js'

async function start () {
  await main()
  process.exit(0)
}

await start()
