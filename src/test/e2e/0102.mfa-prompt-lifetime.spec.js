/**
 * #4634 - an interactive prompt (MFA code, password, host key trust) outlived
 * the connection that asked for it.
 *
 * A session with an MFA code reconnects after a network drop, shows the code
 * dialog, and if nobody answers it the handshake times out underneath the
 * dialog. Before the fix the dialog stayed on screen - a modal with a mask, so
 * the whole window was dead, cancelling it only revealed the next stale prompt
 * queued by the next auto reconnect - and the tab kept reconnecting forever.
 *
 * Runs against its own ssh2 server, DATA_PATH and HOME, so nothing here needs
 * TEST_HOST or touches the real config.
 */

const { _electron: electron, test } = require('@playwright/test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { once } = require('node:events')
const { Server, utils } = require('@electerm/ssh2')
const appOptions = require('./common/app-options')

test.setTimeout(180000)

const USER = 'tester'
const PASSWORD = 'electerm-test'
const OTP = '123456'

// the keyboard-interactive `name`, which the dialog renders as its title
const PROMPT_TITLE = 'MFA required'
const mfaModal = `.custom-modal-wrap:has(.custom-modal-title:text("${PROMPT_TITLE}"))`
const trustModal = '.custom-modal-wrap:has-text("Trust and Save")'

async function startMfaServer () {
  const hostKey = utils.generateKeyPairSync('ed25519', { comment: 'e2e-mfa' })
  const clients = new Set()
  const server = new Server({ hostKeys: [hostKey.private] }, (client) => {
    clients.add(client)
    client.on('close', () => clients.delete(client))
    client.on('authentication', (ctx) => {
      if (ctx.method === 'none') {
        return ctx.reject(['keyboard-interactive'])
      }
      if (ctx.method === 'keyboard-interactive' && ctx.username === USER) {
        return ctx.prompt(
          [{ prompt: 'Verification code:', echo: false }],
          PROMPT_TITLE,
          'otp round',
          (res) => {
            if (res[0] === OTP) {
              ctx.accept()
            } else {
              ctx.reject(['keyboard-interactive'])
            }
          }
        )
      }
      return ctx.reject(['keyboard-interactive'])
    })
    client.on('ready', () => {
      client.on('session', (accept) => {
        const s = accept()
        // want_reply is not always set, so the accept callback can be missing
        s.on('env', (a) => { if (typeof a === 'function') a() })
        s.on('pty', (a) => { if (typeof a === 'function') a() })
        s.on('shell', (a) => {
          const st = a()
          st.write('mfa server ready\n')
        })
      })
    })
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return {
    port: server.address().port,
    // a network drop: the listener stays up, the established sessions die
    dropClients () {
      for (const c of clients) {
        c.end()
      }
    },
    close () {
      return new Promise(resolve => server.close(resolve))
    }
  }
}

test('an unanswered MFA prompt closes itself and stops the reconnect loop', async () => {
  const server = await startMfaServer()
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-mfa-e2e-'))
  const app = await electron.launch({
    ...appOptions,
    args: [...appOptions.args, `--user-data-dir=${path.join(root, 'userdata')}`],
    env: {
      ...appOptions.env,
      DATA_PATH: path.join(root, 'data'),
      // keep known_hosts / ~/.ssh away from the real home
      HOME: path.join(root, 'home')
    }
  })
  try {
    const page = await app.firstWindow()
    await page.waitForFunction(() => window.store?.configLoaded === true, null, { timeout: 30000 })
    // a generous first timeout: the code has to be typed in before it expires
    await page.evaluate(() => {
      window.store.setConfig({
        sshReadyTimeout: 60000,
        autoReconnectTerminal: true
      })
    })
    await page.waitForTimeout(1500)

    // --- connect once, answer the code ---
    await page.evaluate(({ port, user, password }) => {
      window.store.addTab({
        host: '127.0.0.1',
        port,
        username: user,
        password,
        type: 'ssh',
        from: 'bookmarks'
      })
    }, { port: server.port, user: USER, password: PASSWORD })

    await page.waitForSelector(trustModal, { timeout: 30000 })
    await page.click('.custom-modal-wrap button:has-text("Trust and Save")')
    await page.waitForSelector(mfaModal, { timeout: 30000 })
    await page.fill(`${mfaModal} input`, OTP)
    await page.click(`${mfaModal} button[type=submit]`)
    await page.waitForSelector(mfaModal, { state: 'detached', timeout: 15000 })
    // The tab status flips to `success` a tick after the prompt is accepted;
    // on a loaded CI runner that gap is wide enough to lose the race.
    await page.waitForFunction(() => {
      const tabs = window.store.tabs
      return tabs.length === 2 && tabs[1].status === 'success'
    }, null, { timeout: 30000 }).catch(() => {})
    const connected = await page.evaluate(() => window.store.tabs.map(t => ({ id: t.id, status: t.status })))
    assert.equal(connected.length, 2, 'local tab + ssh tab')
    assert.equal(connected[1].status, 'success', 'the ssh session is up')

    // --- network drop, and a short timeout for what follows ---
    await page.evaluate(() => window.store.setConfig({ sshReadyTimeout: 8000 }))
    server.dropClients()
    await page.waitForSelector(mfaModal, { timeout: 40000 })
    const tabAtPrompt = await page.evaluate(() => window.store.tabs.map(t => t.id))
    assert.equal(tabAtPrompt.length, 2, 'the reconnect reused the tab slot')

    // --- walk away: the handshake times out under the dialog ---
    await page.waitForSelector(mfaModal, { state: 'detached', timeout: 40000 })
    assert.equal(await page.locator('.custom-modal-wrap').count(), 0,
      'the dead prompt must take its dialog down')

    // and no further attempt: the session is stopped, not reconnecting
    await page.waitForTimeout(15000)
    assert.equal(await page.locator('.custom-modal-wrap').count(), 0,
      'no new prompt may queue up behind the dead one')
    const after = await page.evaluate(() => window.store.tabs.map(t => ({ id: t.id, status: t.status })))
    assert.deepEqual(after.map(t => t.id), tabAtPrompt,
      'the tab must not be reloaded into another attempt')
    assert.equal(after[1].status, 'error', 'the session is reported as failed')
    assert.ok(await page.locator('.terminal-session-stopped').count() > 0,
      'the dead session offers its way out instead of retrying')
  } finally {
    await app.close().catch(console.log)
    await server.close().catch(() => {})
  }
})
