/**
 * Integration test for issue #4427:
 * Connection hopping fails with "All configured authentication methods failed"
 * when target SSH server only supports keyboard-interactive authentication.
 *
 * This test requires Docker. It starts two containers:
 *   1. jump-host — OpenSSH with password auth + TCP forwarding
 *   2. target-server — standard OpenSSH configured with keyboard-interactive ONLY (no password method)
 *
 * Prerequisites:
 *   cd temp/dockers/ssh-hopping && docker compose up -d --build
 *
 * Run: node --test test/integration/session-ssh-hopping.spec.js
 */

process.env.NODE_ENV = 'development'

const { describe, test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { execSync } = require('node:child_process')
const { setTimeout: delay } = require('node:timers/promises')
const path = require('node:path')
const net = require('node:net')
const { session } = require('../../src/app/server/session-ssh')

const COMPOSE_DIR = path.resolve(__dirname, '../../temp/dockers/ssh-hopping')
const JUMP_HOST_PORT = 2230
const JUMP_HOST = '127.0.0.1'
const JUMP_USERNAME = 'tester'
const JUMP_PASSWORD = 'jump-password'
const TARGET_HOST = 'target-server'
const TARGET_PORT = 22
const TARGET_USERNAME = 'tester'
const TARGET_PASSWORD = 'target-password'
const READY_TIMEOUT = 30000

function isDockerAvailable () {
  try {
    execSync('docker info', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

function areContainersRunning () {
  try {
    const out = execSync('docker compose ps -q', {
      cwd: COMPOSE_DIR,
      encoding: 'utf8',
      stdio: 'pipe'
    })
    return out.trim().length > 0
  } catch {
    return false
  }
}

function composeUp () {
  execSync('docker compose up -d', {
    cwd: COMPOSE_DIR,
    stdio: 'pipe',
    timeout: 120000
  })
}

function waitForPort (host, port, timeout = READY_TIMEOUT) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    function tryConnect () {
      if (Date.now() - start > timeout) {
        return reject(new Error(`Timeout waiting for ${host}:${port}`))
      }
      const sock = net.connect(port, host)
      sock.setTimeout(2000)
      sock.on('connect', () => {
        sock.destroy()
        resolve()
      })
      sock.on('error', () => {
        sock.destroy()
        setTimeout(tryConnect, 500)
      })
      sock.on('timeout', () => {
        sock.destroy()
        setTimeout(tryConnect, 500)
      })
    }
    tryConnect()
  })
}

/**
 * Verify the target server inside the Docker network is listening on port 2222.
 */
async function waitForTargetReady (timeout = READY_TIMEOUT) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      const out = execSync(
        'docker compose exec -T target-server bash -c ' +
        "'echo ok > /dev/tcp/127.0.0.1/22 && echo ok || echo fail'",
        { cwd: COMPOSE_DIR, encoding: 'utf8', stdio: 'pipe', timeout: 10000 }
      )
      if (out.includes('ok')) return
    } catch {
      // ignore
    }
    await delay(1000)
  }
  throw new Error('Target server not ready within timeout')
}

function createHoppingWs (options = {}) {
  const {
    autoTrustHost = true,
    promptResponder
  } = options
  const prompts = []
  let pendingOptions
  return {
    prompts,
    s (payload) {
      if (payload && payload.action === 'session-interactive') {
        pendingOptions = payload.options
        prompts.push(payload.options)
      }
    },
    once (handler) {
      const currentOptions = pendingOptions
      queueMicrotask(() => {
        if (currentOptions?.mode === 'confirm' && autoTrustHost) {
          handler({ results: ['trust'] })
        } else if (promptResponder) {
          handler({ results: promptResponder(currentOptions, prompts) })
        } else {
          handler({ results: [] })
        }
      })
    },
    close () {}
  }
}

describe('session-ssh connection hopping with keyboard-interactive-only target (#4427)', () => {
  let dockerAvailable

  before(async () => {
    dockerAvailable = isDockerAvailable()
    if (!dockerAvailable) {
      console.log('Docker not available — skipping integration test')
      return
    }
    if (!areContainersRunning()) {
      console.log('Starting Docker containers...')
      composeUp()
    }
    // Wait for jump host port to be open
    await waitForPort(JUMP_HOST, JUMP_HOST_PORT)
    // Wait for target server to be ready inside the Docker network
    await waitForTargetReady()
    // Small extra delay to ensure SSH is fully initialized
    await delay(1000)
  })

  after(() => {
    // Leave containers running for debugging
    // Run `docker compose down` in temp/dockers/ssh-hopping to clean up
  })

  test('connects to keyboard-interactive-only target through jump host', async (t) => {
    if (!dockerAvailable) {
      t.skip('Docker not available')
      return
    }

    const ws = createHoppingWs({
      autoTrustHost: true,
      promptResponder: (options) => {
        // If we get a keyboard-interactive prompt for a password,
        // provide the target password as fallback.
        // After the fix, this should NOT be needed because the password
        // should be auto-filled from the hopping config.
        if (options?.prompts?.length === 1) {
          const prompt = options.prompts[0]
          const promptText = (prompt.prompt || '').toLowerCase()
          if (promptText.includes('password') || promptText === '') {
            return [TARGET_PASSWORD]
          }
        }
        return []
      }
    })

    let term
    try {
      term = await session({
        host: TARGET_HOST,
        port: TARGET_PORT,
        username: TARGET_USERNAME,
        password: TARGET_PASSWORD,
        useSshAgent: false,
        enableSsh: false,
        readyTimeout: 15000,
        hasHopping: true,
        connectionHoppings: [{
          host: JUMP_HOST,
          port: JUMP_HOST_PORT,
          username: JUMP_USERNAME,
          password: JUMP_PASSWORD
        }]
      }, ws)

      assert.ok(term, 'session should be created successfully')
    } finally {
      if (term) {
        term.kill()
      }
    }
  })

  test('keyboard-interactive password auto-fill uses target password, not jump host password', async (t) => {
    if (!dockerAvailable) {
      t.skip('Docker not available')
      return
    }

    const ws = createHoppingWs({
      autoTrustHost: true,
      promptResponder: (options) => {
        // If a password prompt is sent to the UI, it means auto-fill failed.
        // Provide the target password as fallback.
        if (options?.prompts?.length === 1) {
          const prompt = options.prompts[0]
          const promptText = (prompt.prompt || '').toLowerCase()
          if (promptText.includes('password') || promptText === '') {
            return [TARGET_PASSWORD]
          }
        }
        return []
      }
    })

    let term
    try {
      term = await session({
        host: TARGET_HOST,
        port: TARGET_PORT,
        username: TARGET_USERNAME,
        password: TARGET_PASSWORD,
        useSshAgent: false,
        enableSsh: false,
        readyTimeout: 15000,
        hasHopping: true,
        connectionHoppings: [{
          host: JUMP_HOST,
          port: JUMP_HOST_PORT,
          username: JUMP_USERNAME,
          password: JUMP_PASSWORD
        }]
      }, ws)

      assert.ok(term, 'session should be created successfully')

      // After the fix, the target's keyboard-interactive password prompt
      // should be auto-filled with the target's password (from hoppingOptions),
      // NOT sent to the UI. Check that no password prompt was sent to the UI.
      const passwordPrompts = ws.prompts.filter(p => {
        if (!p?.prompts?.length) return false
        if (p?.mode === 'confirm') return false
        const promptText = (p.prompts[0].prompt || '').toLowerCase()
        return promptText.includes('password') || promptText === ''
      })

      assert.equal(
        passwordPrompts.length, 0,
        'Expected no password prompts sent to UI (should be auto-filled from hopping config), ' +
        'but got: ' + JSON.stringify(passwordPrompts.map(p => p.prompts?.[0]?.prompt))
      )
    } finally {
      if (term) {
        term.kill()
      }
    }
  })
})
