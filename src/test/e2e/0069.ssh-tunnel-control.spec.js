const { _electron: electron, test, expect } = require('@playwright/test')
const { once } = require('node:events')
const fs = require('node:fs/promises')
const net = require('node:net')
const os = require('node:os')
const path = require('node:path')
const appOptions = require('./common/app-options')
const { getFreePort } = require('../../app/lib/free-port')
const {
  startTestSshServer, stopTestSshServer, HOST_KEY_PUBLIC, TEST_USERNAME, TEST_PASSWORD
} = require('../integration/lib/ssh-test-server')

async function echo (port, message) {
  const socket = net.connect(port, '127.0.0.1')
  try {
    await once(socket, 'connect')
    socket.write(message)
    const [data] = await once(socket, 'data')
    return data.toString()
  } finally {
    socket.destroy()
  }
}

test('manages an individual forward on a connected SSH tab', async () => {
  test.setTimeout(90000)
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'electerm-tunnels-'))
  const server = await startTestSshServer({ port: 0 })
  server.on('connection', client => {
    client.on('tcpip', accept => {
      const channel = accept()
      channel.on('data', data => channel.write(data))
    })
  })
  let app
  try {
    const sshPort = server.address().port
    await fs.mkdir(path.join(profile, '.ssh'))
    await fs.writeFile(path.join(profile, '.ssh', 'known_hosts'), `[127.0.0.1]:${sshPort} ${HOST_KEY_PUBLIC}\n`)
    const savedPort = await getFreePort({ from: 32000 })
    const temporaryPort = await getFreePort({ from: savedPort + 1 })
    const saved = {
      name: 'Saved forward',
      sshTunnel: 'forwardLocalToRemote',
      sshTunnelLocalPort: String(savedPort),
      sshTunnelRemotePort: 80
    }
    app = await electron.launch({
      ...appOptions,
      env: { ...appOptions.env, HOME: profile, USERPROFILE: profile, DATA_PATH: path.join(profile, 'data') }
    })
    const page = await app.firstWindow()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.waitForFunction(() => window.store?.configLoaded === true)
    await page.setViewportSize({ width: 1200, height: 800 })
    await page.evaluate(options => window.store.addTab(options), {
      type: 'ssh',
      host: '127.0.0.1',
      port: sshPort,
      username: TEST_USERNAME,
      password: TEST_PASSWORD,
      enableSftp: false,
      sshTunnels: [saved]
    })
    const title = await page.evaluate(() => window.translate('sshTunnel'))
    await page.getByRole('button', { name: title, exact: true }).click()
    const panel = page.locator('.ssh-tunnel-panel:visible')
    await expect(panel).toContainText('Saved forward')
    await panel.getByRole('button', { name: 'Add temporary tunnel' }).click()
    await panel.locator('#sshTunnelLocalPort').fill(String(temporaryPort))
    await panel.locator('#name').fill('Temporary forward')
    await panel.getByRole('button', { name: 'Start temporary tunnel' }).click()
    const temporaryRow = panel.locator('.ssh-tunnel-row').filter({ hasText: 'Temporary forward' })
    await expect(temporaryRow).toContainText('Running')
    expect(await echo(temporaryPort, 'temporary')).toBe('temporary')

    await temporaryRow.getByRole('button', { name: 'Stop' }).click()
    await expect(temporaryRow).toContainText('Stopped')
    await expect(echo(temporaryPort, 'stopped')).rejects.toThrow(/ECONNREFUSED/)
    expect(await echo(savedPort, 'still connected')).toBe('still connected')
    expect(await page.evaluate(() => window.store.currentTab.sshTunnels)).toEqual([saved])
    const result = await page.evaluate(() => window.wsFetch({
      action: 'exec-cmd', pid: window.store.currentTab.id, cmd: 'echo connected'
    }))
    expect(result.stdout.trim()).toBe('connected')

    await page.setViewportSize({ width: 390, height: 800 })
    await page.locator('.session-current .mobile-control-toggle').click()
    await page.getByRole('button', { name: title, exact: true }).click()
    const dialog = page.getByRole('dialog', { name: title })
    await dialog.locator('.ssh-tunnel-row').filter({ hasText: 'Temporary forward' })
      .getByRole('button', { name: 'Start' }).click()
    await expect(dialog.locator('.ssh-tunnel-row').filter({ hasText: 'Temporary forward' })).toContainText('Running')
    expect(await echo(temporaryPort, 'restarted')).toBe('restarted')
    await page.evaluate(() => window.store.reloadTab())
    await page.waitForFunction(() => window.store.currentTab.status === 'success')
    const results = await page.evaluate(() => window.store.currentTab.sshTunnelResults)
    expect(results.map(row => row.sshTunnel.name)).toEqual(['Saved forward'])
    await expect(echo(temporaryPort, 'previous connection')).rejects.toThrow(/ECONNREFUSED/)
  } finally {
    await app?.close()
    await stopTestSshServer(server)
    await fs.rm(profile, { recursive: true, force: true })
  }
})
