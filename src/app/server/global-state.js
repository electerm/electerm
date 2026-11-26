// global-state.js
class GlobalState {
  #sessions = {}
  #authed = false

  // Sessions management
  getSession (id) {
    return this.#sessions[id]
  }

  setSession (id, data) {
    this.#sessions[id] = data
  }

  removeSession (id) {
    delete this.#sessions[id]
  }

  get authed () {
    return this.#authed
  }

  set authed (val) {
    this.#authed = val
  }

  get data () {
    return {
      sessions: this.#sessions,
      authed: this.#authed
    }
  }
}

// Export a singleton instance
module.exports = new GlobalState()
