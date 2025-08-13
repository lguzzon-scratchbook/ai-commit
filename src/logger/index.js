export class Logger {
  constructor (verbose = false) {
    this.verbose = verbose
  }

  info (message) {
    if (this.verbose) {
      console.info(message)
    }
  }

  warn (message) {
    console.warn(message)
  }

  error (message) {
    console.error(message)
  }

  debug (message) {
    if (this.verbose) {
      console.debug(`[DEBUG] ${message}`)
    }
  }
}
