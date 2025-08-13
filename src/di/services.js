import { container, DIContainer } from './container.js'
import { ApiClient } from '../api/client.js'
import { Config } from '../config/index.js'
import { Logger } from '../logger/index.js'
import { GitOperations } from '../git/operations.js'
import { CommitGenerator } from '../commit/generator.js'

/**
 * Service definitions for dependency injection
 */

// Register API Client service
container.register('apiClient', (diContainer) => {
  const config = diContainer.get('config')
  return new ApiClient(config.apiKey, config.model)
}, true)

// Register Config service
container.register('config', (diContainer) => {
  const cliArgs = diContainer.get('cliArgs')
  return new Config(cliArgs.getAll())
}, true)

// Register Logger service
container.register('logger', (diContainer) => {
  const config = diContainer.get('config')
  const verbose = config.verbose
  return new Logger(verbose)
}, true)

// Register Git Operations service
container.register('gitOperations', () => {
  return GitOperations
}, true)

// Register Commit Generator service
container.register('commitGenerator', (diContainer) => {
  const apiClient = diContainer.get('apiClient')
  const logger = diContainer.get('logger')
  return new CommitGenerator(apiClient, logger.verbose)
}, true)

// Register main application service
container.register('app', (diContainer) => {
  const CliArgs = diContainer.get('cliArgs')
  const config = diContainer.get('config')
  const logger = diContainer.get('logger')
  const apiClient = diContainer.get('apiClient')
  const gitOps = diContainer.get('gitOperations')
  const commitGenerator = diContainer.get('commitGenerator')

  return {
    cliArgs: CliArgs.getAll(),
    config,
    logger,
    apiClient,
    gitOps,
    commitGenerator
  }
}, true)

// Register CLI Args service (mock for now, could be improved)
container.register('cliArgs', () => {
  // This could be enhanced to support dependency injection for CLI args
  return {
    getAll: () => {
      // Parse process.argv or use existing logic
      const args = {}
      process.argv.slice(2).forEach(arg => {
        if (arg.startsWith('--')) {
          const [key, value] = arg.slice(2).split('=')
          args[key] = value || true
        } else if (arg.startsWith('-')) {
          args[arg.slice(1)] = true
        }
      })
      return args
    }
  }
}, true)

/**
 * Helper function to get all services
 * @returns {Object} All registered services
 */
export function getServices () {
  return {
    apiClient: container.get('apiClient'),
    config: container.get('config'),
    logger: container.get('logger'),
    gitOps: container.get('gitOperations'),
    commitGenerator: container.get('commitGenerator'),
    app: container.get('app'),
    cliArgs: container.get('cliArgs')
  }
}

/**
 * Helper function to create a test container with mocked services
 * @param {Object} mocks - Service mocks
 * @returns {DIContainer} Test container
 */
export function createTestContainer (mocks = {}) {
  const testContainer = new DIContainer()

  // Register all standard services
  testContainer.register('config', (diContainer) => {
    const cliArgs = diContainer.get('cliArgs')
    return mocks.config || new Config(cliArgs.getAll())
  }, true)
  testContainer.register('logger', (diContainer) => {
    const config = diContainer.get('config')
    return new Logger(config.verbose ?? false)
  }, true)
  testContainer.register('apiClient', (diContainer) => {
    return mocks.apiClient || new ApiClient('test-key', 'test-model')
  }, true)
  testContainer.register('gitOperations', () => mocks.gitOperations || GitOperations, true)
  testContainer.register('commitGenerator', (diContainer) => {
    const apiClient = diContainer.get('apiClient')
    const logger = diContainer.get('logger')
    return mocks.commitGenerator || new CommitGenerator(apiClient, logger.verbose)
  }, true)
  testContainer.register('cliArgs', () => mocks.cliArgs || {
    getAll: () => ({})
  }, true)

  return testContainer
}
