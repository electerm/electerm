// global-state.js
class GlobalState {
  #sessions = {}
  #upgradeInsts = {}
  #authed = false

  // Sessions management
  getSession (sessionId) {
    return this.#sessions[sessionId]
  }

  setSession (sessionId, data) {
    this.#sessions[sessionId] = data
  }

  removeSession (sessionId) {
    delete this.#sessions[sessionId]
  }

  // Upgrade instances management
  getUpgradeInst (id) {
    return this.#upgradeInsts[id]
  }

  setUpgradeInst (id, inst) {
    this.#upgradeInsts[id] = inst
  }

  removeUpgradeInst (id) {
    delete this.#upgradeInsts[id]
  }

  get authed () {
    return this.#authed
  }

  set authed (val) {
    this.#authed = val
  }
}

// Export a singleton instance
module.exports = new GlobalState()
