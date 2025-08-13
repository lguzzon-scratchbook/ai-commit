/**
 * Simple dependency injection container
 */

export class DIContainer {
  #services = new Map()
  #singletons = new Map()

  /**
   * Register a service with the container
   * @param {string} name - The service name
   * @param {Function} factory - Factory function to create the service
   * @param {boolean} singleton - Whether to cache the service instance
   */
  register (name, factory, singleton = false) {
    if (this.#services.has(name)) {
      throw new Error(`Service '${name}' is already registered`)
    }

    this.#services.set(name, { factory, singleton })
    return this
  }

  /**
   * Register a singleton service
   * @param {string} name - The service name
   * @param {Function} factory - Factory function to create the service
   */
  registerSingleton (name, factory) {
    return this.register(name, factory, true)
  }

  /**
   * Get a service instance
   * @param {string} name - The service name
   * @returns {*} The service instance
   */
  get (name) {
    if (!this.#services.has(name)) {
      throw new Error(`Service '${name}' is not registered`)
    }

    const { factory, singleton } = this.#services.get(name)

    if (singleton) {
      if (!this.#singletons.has(name)) {
        this.#singletons.set(name, factory(this))
      }
      return this.#singletons.get(name)
    }

    return factory(this)
  }

  /**
   * Check if a service is registered
   * @param {string} name - The service name
   * @returns {boolean}
   */
  has (name) {
    return this.#services.has(name)
  }

  /**
   * Remove a service
   * @param {string} name - The service name
   */
  remove (name) {
    this.#services.delete(name)
    this.#singletons.delete(name)
  }

  /**
   * Clear all services
   */
  clear () {
    this.#services.clear()
    this.#singletons.clear()
  }
}

// Global container instance
export const container = new DIContainer()
