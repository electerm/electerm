const { _electron: electron, test, expect } = require('@playwright/test')
const { Server, utils } = require('@electerm/ssh2')
const { once } = require('node:events')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const appOptions = require('./common/app-options')

test('Enter retries a failed SSH connection and reconnects after a network drop', async () => {
  test.setTimeout(90000)
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-enter-'))
  fs.mkdirSync(path.join(root, 'home'))
  const connections = []
  const server = new Server({
    hostKeys: [utils.generateKeyPairSync('ed25519').private]
  }, client => {
    client.on('error', () => {})
    client.on('authentication', ctx => ctx.accept())
    client.on('ready', () => client.on('session', accept => {
      const session = accept()
      session.on('pty', accept => accept?.())
      session.on('shell', accept => {
        const stream = accept()
        const connection = { client, input: '' }
        connections.push(connection)
        stream.on('data', data => { connection.input += data })
      })
    }))
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const { port } = server.address()
  await new Promise(resolve => server.close(resolve))

  const app = await electron.launch({
    ...appOptions,
    env: { ...appOptions.env, DATA_PATH: path.join(root, 'data'), HOME: path.join(root, 'home') }
  })
  try {
    const page = await app.firstWindow()
    await page.waitForFunction(() => window.store?.configLoaded)
    await page.waitForFunction(() => window.store.tabs.length && window.store.activeTabId)
    await page.evaluate(port => {
      window.store.setConfig({ autoReconnectTerminal: false })
      window.store.addTab({ type: 'ssh', host: '127.0.0.1', port, username: 'tester', password: 'test', enableSftp: false })
    }, port)
    const pane = page.locator('.term-wrap:not(.terminal-not-active)')
    const stopped = pane.locator('.terminal-session-stopped')
    await expect(stopped).toBeVisible({ timeout: 20000 })

    server.listen(port, '127.0.0.1')
    await once(server, 'listening')
    // Modified, composing and held keys must leave the stopped tab in place.
    const failedTab = await page.evaluate(() => window.store.activeTabId)
    await page.keyboard.press('Shift+Enter')
    for (const extra of [{ isComposing: true }, { repeat: true }]) {
      await page.evaluate(extra => document.activeElement.dispatchEvent(new window.KeyboardEvent('keydown', {
        key: 'Enter', bubbles: true, cancelable: true, ...extra
      })), extra)
    }
    expect(await page.evaluate(() => window.store.activeTabId)).toBe(failedTab)
    // Press the key wherever the failed connection naturally left focus.
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: 'Trust and Save' }).click({ timeout: 15000 })
    await expect(stopped).toHaveCount(0)
    await expect.poll(() => connections.length).toBe(1)
    await expect(pane.locator('.xterm-helper-textarea')).toBeFocused()
    await page.keyboard.type('before-drop')
    await expect.poll(() => connections[0].input).toContain('before-drop')

    connections[0].client.end()
    await expect(stopped).toBeVisible({ timeout: 15000 })
    await page.keyboard.press('Enter')
    await expect.poll(() => connections.length, { timeout: 10000 }).toBe(2)
    await expect(stopped).toHaveCount(0)
    await expect(pane.locator('.xterm-helper-textarea')).toBeFocused()
    await page.keyboard.type('after-drop')
    await expect.poll(() => connections[1].input).toContain('after-drop')

    // Enter on the overlay's Close button must still close this tab.
    connections[1].client.end()
    await expect(stopped).toBeVisible({ timeout: 15000 })
    await stopped.getByRole('button', { name: /Close/i }).focus()
    await page.keyboard.press('Enter')
    await expect.poll(() => page.evaluate(() => window.store.tabs.some(t => t.type === 'ssh'))).toBe(false)
  } finally {
    await app.close()
    for (const { client } of connections) client.end()
    await new Promise(resolve => server.close(resolve))
    fs.rmSync(root, { recursive: true, force: true })
  }
})
