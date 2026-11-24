const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { once } = require('node:events')
const { execFileSync } = require('node:child_process')
const os = require('node:os')
const { Server, utils } = require('@electerm/ssh2')
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const { seedIsolatedData } = require('./e2e/common/webgl-test-isolation')

const root = path.resolve(__dirname, '../..')
const data = path.join(root, '.cache', 'smoke-' + Date.now())
fs.mkdirSync(path.join(data, '.ssh'), { recursive: true })
seedIsolatedData(data)
if (process.env.SMOKE_HTTP_CACHE) {
  fs.cpSync(process.env.SMOKE_HTTP_CACHE, path.join(data, 'chromium/Cache'), { recursive: true })
}
const hostKey = utils.generateKeyPairSync('ed25519')
const clients = new Set()
const requests = []
let shellCount = 0
let monitorSamples = 0
let fixtureShell
const attrs = { mode: 0o40755, uid: 1000, gid: 1000, size: 0, atime: 1, mtime: 1 }

function processSnapshot (pid) {
  const script = `
    $all = @(Get-CimInstance Win32_Process)
    $ids = @(${pid})
    do {
      $next = @($all | Where-Object { $_.ParentProcessId -in $ids -and $_.ProcessId -notin $ids } | ForEach-Object { $_.ProcessId })
      $ids += $next
    } while ($next.Count)
    Get-Process | Where-Object { $_.Id -in $ids } |
      Select-Object Id,ProcessName,CPU,WorkingSet64,PrivateMemorySize64 |
      ConvertTo-Json -Compress
  `
  return JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-Command', script], { encoding: 'utf8', windowsHide: true }))
}

async function measureIdle (page, app) {
  if (process.env.TEST_COMPACT) return null
  const pid = await app.evaluate(() => process.pid)
  const before = processSnapshot(pid)
  const start = Date.now()
  await page.waitForTimeout(15000)
  const after = processSnapshot(pid)
  const seconds = (Date.now() - start) / 1000
  const cpuSeconds = after.reduce((sum, p) => {
    const prior = before.find(b => b.Id === p.Id)
    return sum + (prior ? Math.max(0, p.CPU - prior.CPU) : 0)
  }, 0)
  return {
    seconds,
    logicalCpus: os.cpus().length,
    cpuPercentOfMachine: cpuSeconds / seconds / os.cpus().length * 100,
    cpuPercentOfOneCore: cpuSeconds / seconds * 100,
    workingSetMiB: after.reduce((sum, p) => sum + p.WorkingSet64, 0) / 1048576,
    privateMiB: after.reduce((sum, p) => sum + p.PrivateMemorySize64, 0) / 1048576,
    processes: after
  }
}

const server = new Server({ hostKeys: [hostKey.private] }, client => {
  clients.add(client)
  client.on('close', () => clients.delete(client))
  client.on('error', () => {})
  client.on('authentication', ctx => {
    if (ctx.method === 'password' && ctx.password === 'fixture') ctx.accept()
    else ctx.reject(['password'])
  })
  client.on('ready', () => client.on('session', accept => {
    const session = accept()
    session.on('env', accept => accept?.())
    session.on('pty', accept => accept())
    session.on('window-change', accept => accept?.())
    session.on('exec', (accept, reject, info) => {
      const stream = accept()
      if (info.command.includes('/proc/meminfo')) monitorSamples++
      const output = info.command.includes('SHELL')
        ? '/bin/bash\n'
        : info.command.includes('getent')
          ? 'tester:x:1000:1000::/home/tester:/bin/bash\n'
          : info.command.includes('/proc/meminfo')
            ? 'MemTotal: 8000000 kB\nMemAvailable: 4000000 kB\n'
            : info.command.includes('/proc/stat') ? 'CPU 43%\n' : ''
      stream.exit(0)
      stream.end(output)
    })
    session.on('shell', accept => {
      shellCount++
      const stream = accept()
      fixtureShell = stream
      let cwd = '/home/tester'
      let input = ''
      const prompt = () => stream.write(`\x1b]633;P;Cwd=${cwd}\x07\x1b]633;A\x07tester:${cwd}$ \x1b]633;B\x07`)
      stream.write('tester@fixture:~$ ')
      stream.on('data', chunk => {
        input += chunk.toString()
        if (!/[\r\n]/.test(input)) return
        const commands = input.split(/[\r\n]+/)
        input = commands.pop()
        for (const command of commands) {
          if (command.includes('ELECTERM_SHELL_INTEGRATION')) {
            prompt()
          } else if (command.startsWith('cd ')) {
            cwd = command.slice(3).trim()
            stream.write(`\r\n${command}\r\n`)
            prompt()
          } else {
            stream.write(`\r\n${command}\r\n`)
            prompt()
          }
        }
      })
    })
    session.on('sftp', accept => {
      const sftp = accept()
      const directories = new Map()
      let id = 0
      sftp.on('REALPATH', (req, p) => sftp.name(req, [{ filename: p === '.' ? '/home/tester' : p, longname: '', attrs }]))
      sftp.on('STAT', req => sftp.attrs(req, attrs))
      sftp.on('LSTAT', req => sftp.attrs(req, attrs))
      sftp.on('OPENDIR', (req, p) => {
        requests.push(p)
        const handle = Buffer.alloc(4)
        handle.writeUInt32BE(++id)
        directories.set(id, { path: p, read: false })
        sftp.handle(req, handle)
      })
      sftp.on('READDIR', (req, handle) => {
        const directory = directories.get(handle.readUInt32BE())
        if (directory.read) return sftp.status(req, 1)
        directory.read = true
        const name = directory.path.replaceAll('/', '_') + '-marker'
        setTimeout(() => {
          const names = directory.path === '/home/tester'
            ? [name, ...Array.from({ length: 240 }, (_, i) => `sample-${String(i).padStart(3, '0')}`)]
            : [name]
          sftp.name(req, names.map(filename => ({
            filename,
            longname: filename,
            attrs: { ...attrs, mode: 0o100644, size: 8 }
          })))
        }, directory.path === '/slow' ? 600 : 20)
      })
      sftp.on('CLOSE', (req, handle) => {
        directories.delete(handle.readUInt32BE())
        sftp.status(req, 0)
      })
    })
  }))
})

async function main () {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const port = server.address().port
  const parsed = utils.parseKey(hostKey.private)
  fs.writeFileSync(path.join(data, '.ssh', 'known_hosts'),
    `[127.0.0.1]:${port} ${parsed.type} ${parsed.getPublicSSH().toString('base64')}\n`)
  const errors = []
  const app = await _electron.launch({
    executablePath: process.env.SMOKE_EXE || path.join(root, 'dist/classic-r7/win-unpacked/Electerm Terminal.exe'),
    args: ['--force-device-scale-factor=1.5'],
    timeout: 20000,
    env: { ...process.env, DATA_PATH: data }
  })
  const page = await app.firstWindow()
  app.process().stdout?.on('data', data => console.log('app', data.toString()))
  app.process().stderr?.on('data', data => console.log('app error', data.toString()))
  try {
    page.on('pageerror', err => errors.push(err.message))
    await page.waitForFunction(() => window.store?.tabs.some(t => t.status === 'success'), { timeout: 30000 })
    await page.waitForTimeout(1500)
    const refUrl = await page.evaluate(() => performance.getEntriesByType('resource').map(r => r.name).find(n => /\/ref-[^/]+\.js$/.test(n)))
    assert.ok(refUrl, 'shared ref module loaded')
    await page.evaluate(async url => {
      const exports = await import(url)
      window.testRefs = Object.values(exports).find(v => v?.get?.('term-' + window.store.activeTabId))
    }, refUrl)
    const localId = await page.evaluate(() => window.store.activeTabId)
    if (process.env.TEST_LOCAL_RECONNECT) {
      const number = await page.evaluate(() => window.store.currentTab.tabCount)
      await page.evaluate(id => window.testRefs.get('term-' + id).attachAddon._sendData("Write-Output ('R5_LOCAL_'+'HISTORY')\r"), localId)
      await page.waitForFunction(() => document.body.innerText.includes('R5_LOCAL_HISTORY'))
      await page.evaluate(id => window.testRefs.get('term-' + id).socket.close(), localId)
      await page.locator('.terminal-session-stopped:visible').waitFor()
      await page.locator('.session-batch-active .xterm').click()
      await page.keyboard.press('Shift+R')
      await page.waitForFunction(id => window.store.activeTabId !== id && window.store.currentTab?.status === 'success', localId)
      await page.evaluate(() => window.testRefs.get('term-' + window.store.activeTabId).attachAddon._sendData("Write-Output ('R5_NEW_'+'SHELL')\r"))
      await page.waitForFunction(() => document.body.innerText.includes('R5_NEW_SHELL'))
      assert.equal(await page.evaluate(() => {
        const b = window.testRefs.get('term-' + window.store.activeTabId).term.buffer.normal
        return Array.from({ length: b.length }, (_, i) => b.getLine(i)?.translateToString(true)).some(s => s.includes('R5_LOCAL_HISTORY'))
      }), true, 'old output survives initialization of the new PowerShell')
      assert.equal(await page.evaluate(() => window.store.currentTab.tabCount), number)
      assert.deepEqual(errors, [])
      console.log('PASS: local PowerShell history, same numbered tab, uppercase R reconnect and new shell output')
      return
    }
    if (process.env.TEST_HANDOVER) {
      await page.evaluate(id => {
        const term = window.testRefs.get('term-' + id)
        const old = term.socket
        return new Promise((resolve, reject) => {
          const ws = new WebSocket(old.url)
          ws.binaryType = 'arraybuffer'
          let text = ''
          const timer = setTimeout(() => reject(new Error('replacement socket lost its shell')), 10000)
          ws.onmessage = ev => {
            if (typeof ev.data === 'string') return
            text += new TextDecoder().decode(ev.data)
            if (text.includes('HANDOVER_OK')) {
              clearTimeout(timer)
              resolve()
            }
          }
          ws.onopen = () => {
            term.socket = ws
            term.trackSessionExit(ws)
            old.addEventListener('close', () => ws.send("Write-Output ('HANDOVER_'+'OK')\r"))
            old.close()
          }
        })
      }, localId)
      assert.equal(await page.evaluate(id => window.store.tabs.find(t => t.id === id).status, localId), 'success')
      console.log('PASS: local shell processes commands after stale socket closes')
      return
    }
    const toolbar = page.locator('.terminal-toolbar')
    assert.equal(await toolbar.locator('button:visible').evaluateAll(buttons => buttons.every(b => b.innerText.trim())), true)
    const localeCheck = await page.evaluate(() => {
      const initial = Object.keys(window.langMap).length
      const lang = window.getLang('zh_cn')
      return { initial, keepalive: lang.keepalive, choices: window.et.langs.length }
    })
    assert.equal(localeCheck.initial, 1)
    assert.equal(localeCheck.keepalive, '会话保活')
    assert.ok(localeCheck.choices > 1)
    const tabs = page.locator('.layout-item.v1 .tabs')
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      if (win.isMaximized()) return
      return new Promise(resolve => {
        win.once('maximize', resolve)
        win.maximize()
      })
    })
    assert.equal(await page.evaluate(() => window.store.hasNativeTitleStrip), true)
    assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMenuBarVisible()), false)
    assert.equal(await page.evaluate(() => window.devicePixelRatio), 1.5)
    await toolbar.locator('.theme-toggle').click()
    await page.waitForFunction(() => window.store.getUiThemeConfig().main === '#f6f7f8')
    await toolbar.locator('.theme-toggle').click()
    await page.waitForFunction(() => window.store.getUiThemeConfig().main === '#222222')
    const tool = async key => toolbar.getByRole('button', { name: await page.evaluate(key => window.translate(key), key), exact: true })
    await (await tool('local')).click()
    await page.waitForFunction(() => window.store.tabs.length === 2 && window.store.currentTab?.status === 'success')
    const newTab = tabs.locator('.tab.active')
    await newTab.hover()
    await newTab.locator('.tab-close').click()
    await page.waitForFunction(id => window.store.tabs.length === 1 && window.store.activeTabId === id, localId)
    await (await tool('newBookmark')).click()
    const closeButton = page.locator('.setting-wrap .close-setting-wrap')
    await page.locator('.setting-row-right input:visible').first().waitFor()
    const bounds = await closeButton.boundingBox()
    assert.ok(bounds && bounds.y < 15, 'close button in the first content row')
    await page.screenshot({ path: path.join(root, '.cache/classic-r7-settings.png') })
    await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
    await closeButton.waitFor({ state: 'hidden' })
    console.log('PASS: maximized native frame at 150% scale, coordinate click closes panel, light/dark round trip')
    for (const width of [1120, 760]) {
      await page.setViewportSize({ width, height: 750 })
      const rects = await toolbar.evaluate(el => [...el.children].map(c => c.getBoundingClientRect().toJSON()))
      assert.ok(rects.every((r, i) => r.height <= 36 && r.top >= -0.5 && r.bottom <= 36.5 && (!i || r.left >= rects[i - 1].right - 0.5)), `single row without overlaps at ${width}: ${JSON.stringify(rects)}`)
      const tabRect = await tabs.boundingBox()
      assert.ok(tabRect.y >= rects[0].bottom, 'tab strip below session controls')
      for (const key of ['newBookmark', 'settings']) {
        await (await tool(key)).click()
        const drawer = page.locator('.setting-wrap')
        const close = drawer.locator('.close-setting-wrap')
        await close.waitFor()
        assert.equal(await close.count(), 1)
        assert.ok(await close.getAttribute('aria-label'))
        if (key === 'settings' && width === 760) {
          await page.setViewportSize({ width: 520, height: 750 })
          await drawer.locator('.setting-tabs .responsive-tabs-mobile').click()
          await page.getByRole('menuitem').filter({ hasText: await page.evaluate(() => window.translate('bookmarks')) }).click()
          const notices = page.locator('.notification').filter({ hasText: await page.evaluate(() => window.translate('loadSshConfigs')) })
          if (await page.evaluate(() => window.store.sshConfigs.length > 0)) {
            await notices.first().waitFor()
            assert.equal(await notices.count(), 1)
            await notices.locator('.notification-close').click()
            await notices.waitFor({ state: 'hidden' })
          }
          await page.screenshot({ path: path.join(root, '.cache/classic-r7-narrow.png') })
          assert.equal(await close.count(), 1)
        }
        await close.click({ trial: true })
        if (key === 'settings') {
          await close.focus()
          await page.keyboard.press('Enter')
        } else {
          await close.click()
        }
        await drawer.waitFor({ state: 'hidden' })
        assert.equal(await page.locator('.notification').filter({ hasText: await page.evaluate(() => window.translate('loadSshConfigs')) }).count(), 0)
        await page.waitForFunction(() => document.activeElement?.matches('.xterm-helper-textarea'))
        assert.equal(await page.evaluate(() => window.store.activeTabId), localId)
      }
    }
    await page.setViewportSize({ width: 1120, height: 750 })
    console.log('PASS: one working close button in SSH and Settings, desktop and narrow, terminal focus restored')
    const sidebar = page.locator('.session-batch-active .session-sidebar')
    const sessionsButton = sidebar.getByRole('button', { name: await page.evaluate(() => window.translate('bookmarks')), exact: true })
    const fileButton = sidebar.getByRole('button', { name: 'SFTP', exact: true })
    const bookmarks = sidebar.locator('.session-bookmarks .tree-list')
    await bookmarks.waitFor()
    assert.equal(await fileButton.count(), 0, 'no SFTP on local terminals')
    await sessionsButton.click()
    await bookmarks.waitFor({ state: 'hidden' })
    await sessionsButton.click()
    await bookmarks.waitFor()
    const bookmark = bookmarks.locator('.tree-item-title').filter({ hasText: '[local]cmd.exe' })
    await bookmark.click()
    await bookmarks.locator('.tree-item.selected').filter({ hasText: '[local]cmd.exe' }).waitFor()
    assert.equal(await page.evaluate(() => window.store.tabs.length), 1)
    await bookmark.dblclick()
    await page.waitForFunction(id => window.store.activeTabId !== id && window.store.currentTab?.from === 'bookmarks' && window.store.currentTab?.status === 'success', localId)
    await tabs.locator('.tab.active').hover()
    await tabs.locator('.tab.active .tab-close').click()
    await page.waitForFunction(id => window.store.activeTabId === id && window.store.tabs.length === 1, localId)
    await page.setViewportSize({ width: 640, height: 750 })
    await (await tool('local')).click()
    await (await tool('local')).click()
    await page.evaluate(() => window.store.tabs.forEach(t => window.store.updateTab(t.id, { title: 'Long session title for overflow menu' })))
    await tabs.locator('.tabs-dd-icon').click()
    await page.getByRole('menuitem').first().click()
    await page.waitForFunction(id => window.store.activeTabId === id, localId)
    for (let i = 0; i < 2; i++) {
      const tab = tabs.locator('.tab').last()
      await tab.hover()
      await tab.locator('.tab-close').click()
    }
    await tabs.locator('.tab-scroll-icon').first().waitFor({ state: 'hidden' })
    await page.evaluate(id => window.store.updateTab(id, { title: '' }), localId)
    assert.equal(await page.evaluate(() => window.store.activeTabId), localId)
    await page.setViewportSize({ width: 1120, height: 750 })
    console.log('PASS: compact tab overflow, switch using menu, close without losing original shell')
    if (process.env.TEST_TOOLBAR) {
      assert.deepEqual(errors, [])
      return
    }
    const layouts = page.locator('.layout-menu-content:visible')
    for (const [label, count] of [['twoColumns', 2], ['single', 1]]) {
      if (!await layouts.isVisible()) await toolbar.locator('.layout-menu-trigger').click()
      await layouts.getByText(await page.evaluate(key => window.translate(key), label), { exact: true }).click()
      await page.waitForFunction(n => document.querySelectorAll('.layout-item').length === n, count)
      await layouts.waitFor({ state: 'hidden' })
    }
    await page.keyboard.press('Escape')
    const headerConnect = page.locator('.pane-connect')
    assert.equal(await headerConnect.locator('button').isDisabled(), true)
    await headerConnect.locator('.quick-connect-input').click()
    await page.locator('.session-batch-active .xterm').click()
    assert.equal(await page.evaluate(id => !!window.testRefs.get('sftp-' + id), localId), false)
    await page.evaluate(id => window.testRefs.get('term-' + id).attachAddon._sendData("$holdPid=$PID; Write-Output ('LOCAL_'+'OK')\r"), localId)
    await page.waitForFunction(() => document.body.innerText.includes('LOCAL_OK'))
    assert.equal(await page.evaluate(id => window.testRefs.get('term-' + id).term.options.theme.background, localId), '#1e1e1e')
    assert.equal(await page.evaluate(id => window.testRefs.get('term-' + id).term.options.fontSize, localId), 13)
    assert.equal(await page.locator('.monitor-toggle').count(), 0)
    await page.screenshot({ path: path.join(root, '.cache/classic-r7-local.png') })
    const localResources = await measureIdle(page, app)
    const localMetrics = await app.evaluate(({ app }) => app.getAppMetrics())
    const address = page.getByRole('textbox', { name: await page.evaluate(() => window.translate('quickConnect')), exact: true })
    const localHeader = await headerConnect.boundingBox()
    assert.ok(Math.abs(localHeader.width - (await sidebar.boundingBox()).width) < 2)
    await address.fill(`ssh://tester:fixture@127.0.0.1:${port}`)
    await address.press('Enter')
    await page.waitForFunction(() => window.store.currentTab?.host === '127.0.0.1')
    await page.evaluate(() => { window.fixtureId = window.store.activeTabId })
    await page.waitForFunction(() => window.testRefs.get('sftp-' + window.fixtureId)?.state.inited)
    await page.waitForFunction(() => window.testRefs.get('sftp-' + window.fixtureId)?.state.remotePath === '/home/tester')
    const positions = await page.evaluate(() => {
      const sftp = document.querySelector('.session-batch-active .sftp-wrap').getBoundingClientRect()
      const terminal = document.querySelector('.session-batch-active .xterm').getBoundingClientRect()
      return { sftp: sftp.x, terminal: terminal.x, sftpWidth: sftp.width }
    })
    assert.ok(positions.sftpWidth > 0 && positions.sftp < positions.terminal, JSON.stringify(positions))
    assert.deepEqual(await headerConnect.boundingBox(), localHeader)
    assert.ok(Math.abs((await sidebar.boundingBox()).width / 1120 - 0.20) < 0.02)
    await address.fill('in-progress')
    await sessionsButton.click()
    await bookmarks.waitFor()
    await page.locator('.session-current .sftp-wrap').waitFor({ state: 'hidden' })
    await tabs.locator('.tab').first().click()
    await bookmarks.waitFor()
    assert.equal(await fileButton.count(), 0)
    await tabs.locator('.tab').nth(1).click()
    await fileButton.click()
    await page.locator('.session-current .sftp-wrap').waitFor()
    assert.equal(await address.inputValue(), 'in-progress')
    assert.deepEqual(await headerConnect.boundingBox(), localHeader)
    console.log('PASS: local bookmark opens a session, SSH switches between bookmarks and SFTP, quick connect keeps its position and draft')
    assert.equal(shellCount, 1)
    await address.fill('')
    assert.equal(await page.locator('.sftp-wrap .anticon-star').count(), 0)
    const row = await page.locator('.sftp-wrap .sftp-item').filter({ hasText: '_home_tester-marker' }).boundingBox()
    assert.equal(row.height, 20)
    fixtureShell.write('\r\nR6 color check: ERROR OK\x1b[0m\r\n')
    await page.waitForFunction(() => {
      const b = window.testRefs.get('term-' + window.fixtureId).term.buffer.normal
      for (let i = 0; i < b.length; i++) {
        const line = b.getLine(i)
        const text = line.translateToString(true)
        if (text.startsWith('R6 color check:')) {
          return line.getCell(text.indexOf('ERROR')).getFgColor() === 1 &&
            line.getCell(text.indexOf('OK')).getFgColor() === 2
        }
      }
      return false
    })
    const termBox = page.locator('.session-batch-active .term-wrap')
    const termBeforeMonitor = await termBox.boundingBox()
    const footer = await page.locator('.main-footer').boundingBox()
    const list = page.locator('.session-current .sftp-table-content')
    const listBox = await list.boundingBox()
    const grid = await page.locator('.session-current .xterm-screen').boundingBox()
    assert.ok(Math.abs(listBox.y + listBox.height - footer.y) <= 2, JSON.stringify({ listBox, footer }))
    assert.ok(Math.abs(grid.y + grid.height - footer.y) <= 2, JSON.stringify({ grid, footer }))
    await list.evaluate(el => { el.scrollTop = el.scrollHeight })
    await list.getByText('sample-239', { exact: true }).waitFor()
    await list.evaluate(el => { el.scrollTop = 0 })
    async function checkPaneHeader () {
      const connect = await page.locator('.pane-connect').boundingBox()
      const sftp = await page.locator('.session-current .sftp-wrap').boundingBox()
      const header = await tabs.boundingBox()
      assert.ok(Math.abs(connect.width - (await sidebar.boundingBox()).width) < 2 && Math.abs(header.x - sftp.x - sftp.width) < 2)
      assert.ok(Math.abs(connect.y + connect.height - sftp.y) < 2)
    }
    await checkPaneHeader()
    assert.equal(footer.height, 24)
    assert.ok(Math.abs(termBeforeMonitor.y + termBeforeMonitor.height - footer.y) < 2)
    assert.equal((await tabs.boundingBox()).height, 28)
    const monitor = page.locator('.main-footer .remote-monitor-bar')
    const monitorToggle = page.locator('.monitor-toggle')
    assert.equal(monitorSamples, 0)
    await monitorToggle.click()
    await monitor.waitFor()
    await monitor.getByText(/^Mem [\d.]+.* \/ [\d.]+/).waitFor()
    assert.ok(monitorSamples > 0)
    await monitor.locator('[data-monitor-item=cpuHistory] rect').first().waitFor()
    assert.equal((await termBox.boundingBox()).height, termBeforeMonitor.height)
    await page.screenshot({ path: path.join(root, '.cache/classic-r7-monitor.png') })
    await monitorToggle.click()
    await monitor.waitFor({ state: 'hidden' })
    const samplesAfterClose = monitorSamples
    await page.waitForFunction(() => window.testRefs.get('term-' + window.fixtureId).startupQueue?.shellInjected)
    await page.evaluate(() => {
      window.originalSftp = window.testRefs.get('sftp-' + window.fixtureId)
      window.originalTerm = window.testRefs.get('term-' + window.fixtureId)
      window.originalTerm.attachAddon._sendData('cd /slow\r')
    })
    await page.waitForTimeout(100)
    await page.evaluate(() => window.originalTerm.attachAddon._sendData('cd /fast\r'))
    await page.waitForFunction(() => window.originalSftp.state.remotePath === '/fast' && window.originalSftp.state.remote.some(f => f.name === '_fast-marker'))
    await page.waitForTimeout(700)
    assert.equal(await page.evaluate(() => window.originalSftp.state.remote[0].name), '_fast-marker')
    await fileButton.click()
    await page.evaluate(() => window.originalTerm.attachAddon._sendData('cd /hidden\r'))
    await page.waitForTimeout(400)
    const requestCount = requests.length
    await page.waitForTimeout(400)
    assert.equal(requests.length, requestCount, 'collapsed panel does not poll')
    await fileButton.click()
    await page.waitForFunction(() => window.originalSftp.state.remotePath === '/hidden' && window.originalSftp.state.remote.some(f => f.name === '_hidden-marker'))
    assert.equal(await page.evaluate(() => window.originalTerm === window.testRefs.get('term-' + window.fixtureId) && window.originalSftp === window.testRefs.get('sftp-' + window.fixtureId)), true)
    assert.equal(shellCount, 1, 'collapse did not recreate the SSH shell')
    await page.mouse.move(700, 400)
    await page.waitForTimeout(350)
    await page.screenshot({ path: path.join(root, '.cache/classic-r7-ssh.png') })
    await page.setViewportSize({ width: 900, height: 650 })
    await page.waitForTimeout(500)
    await page.screenshot({ path: path.join(root, '.cache/classic-r7-compact.png') })
    const sshResources = await measureIdle(page, app)
    assert.equal(await page.evaluate(() => window.store.tabs.find(t => t.id === window.fixtureId).status), 'success')
    const sshMetrics = await app.evaluate(({ app }) => app.getAppMetrics())
    assert.equal(monitorSamples, samplesAfterClose, 'disabled monitor stopped polling')
    const tabNumber = await page.evaluate(() => window.store.currentTab.tabCount)
    fixtureShell.write('\r\nR5_OLD_HISTORY\r\n' + 'scroll line\r\n'.repeat(100))
    await page.waitForFunction(() => window.originalTerm.term.buffer.active.baseY > 50)
    await page.locator('.session-batch-active .xterm').click()
    fixtureShell.exit(0)
    fixtureShell.end()
    await page.locator('.terminal-session-stopped:visible').waitFor()
    await address.fill('r')
    assert.equal(shellCount, 1)
    await address.fill('')
    await page.locator('.session-batch-active .xterm').click()
    await page.keyboard.press('r')
    await page.waitForFunction(() => window.store.currentTab?.status === 'success' && window.store.activeTabId !== window.fixtureId)
    assert.equal(await page.evaluate(() => window.store.currentTab.tabCount), tabNumber)
    await page.evaluate(() => {
      window.fixtureId = window.store.activeTabId
      window.originalTerm = window.testRefs.get('term-' + window.fixtureId)
      window.originalSftp = window.testRefs.get('sftp-' + window.fixtureId)
    })
    assert.equal(await page.evaluate(() => {
      const b = window.originalTerm.term.buffer.normal
      return Array.from({ length: b.baseY }, (_, i) => b.getLine(i)?.translateToString(true)).includes('R5_OLD_HISTORY')
    }), true, 'previous offscreen output was replayed')
    await page.waitForFunction(() => window.originalTerm.startupQueue?.shellInjected && window.originalSftp.state.inited)
    await page.keyboard.type('r')
    await page.keyboard.press('Enter')
    await page.waitForFunction(() => document.body.innerText.split(/\r?\n/).includes('r'))
    assert.equal(shellCount, 2, 'live r goes to the shell instead of reconnecting')
    console.log('PASS: SSH disconnect, R reconnect in same numbered tab, offscreen history replay and live r input')
    const idleMs = process.env.TEST_COMPACT ? 500 : 130000
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].minimize())
    console.log(`Testing ${idleMs / 1000}s minimized idle`)
    await new Promise(resolve => setTimeout(resolve, idleMs))
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].restore())
    await page.evaluate(() => window.originalTerm.attachAddon._sendData('cd /after-idle\r'))
    await page.waitForFunction(() => window.originalSftp.state.remote.some(f => f.name === '_after-idle-marker'))
    assert.equal(shellCount, 2)
    const activeSftp = page.locator('.session-batch-active .sftp-wrap')
    const beforeDrag = (await activeSftp.boundingBox()).width
    const dragger = page.locator('.session-batch-active .term-sftp-box > .ant-splitter > .ant-splitter-bar .ant-splitter-bar-dragger')
    const grip = await dragger.boundingBox()
    assert.ok(await dragger.evaluate(el => {
      const r = el.getBoundingClientRect()
      return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
    }), 'the centre of the splitter is reachable')
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
    await page.mouse.down()
    await page.mouse.move(grip.x + grip.width / 2 + 64, grip.y + grip.height / 2, { steps: 8 })
    await page.mouse.up()
    await page.waitForFunction(w => document.querySelector('.session-batch-active .sftp-wrap').getBoundingClientRect().width > w + 55, beforeDrag)
    const resized = (await activeSftp.boundingBox()).width
    await checkPaneHeader()
    await address.fill(`ssh://tester:fixture@127.0.0.1:${port}`)
    await address.press('Enter')
    await page.waitForFunction(() => window.store.activeTabId !== window.fixtureId && window.store.currentTab?.status === 'success')
    await activeSftp.waitFor()
    assert.ok(Math.abs((await activeSftp.boundingBox()).width - resized) < 2)
    const secondGrip = await dragger.boundingBox()
    await page.mouse.move(secondGrip.x + secondGrip.width / 2, secondGrip.y + secondGrip.height / 2)
    await page.mouse.down()
    await page.mouse.move(secondGrip.x + secondGrip.width / 2 - 40, secondGrip.y + secondGrip.height / 2, { steps: 6 })
    await page.mouse.up()
    await page.waitForFunction(w => document.querySelector('.session-batch-active .sftp-wrap').getBoundingClientRect().width < w - 30, resized)
    const secondWidth = (await activeSftp.boundingBox()).width
    await tabs.locator('.tab').nth(1).click()
    await page.waitForFunction(() => window.store.activeTabId === window.fixtureId)
    assert.ok(Math.abs((await activeSftp.boundingBox()).width - secondWidth) < 2)
    await tabs.locator('.tab').first().click()
    await page.evaluate(id => {
      window.testRefs.get('term-' + id).attachAddon._sendData("if ($holdPid -eq $PID) { Write-Output ('SAME_'+'POWERSHELL') }\r")
    }, localId)
    await page.waitForFunction(() => document.body.innerText.includes('SAME_POWERSHELL'))
    await page.evaluate(() => {
      window.store.settingTab = 'profiles'
      window.store.setSettingItem({ id: '', name: 'profile' })
      window.store.openSettingModal()
    })
    await page.getByRole('tab', { name: 'ssh', exact: true }).waitFor()
    for (const name of ['telnet', 'vnc', 'rdp', 'ftp']) {
      assert.equal(await page.getByRole('tab', { name, exact: true }).count(), 0)
    }
    await page.evaluate(() => window.store.hideSettingModal())
    assert.deepEqual(errors, [])
    const report = { localResources, sshResources, idleMs, localMetrics, sshMetrics, requests, shellCount, errors, data }
    fs.writeFileSync(path.join(root, '.cache/classic-r7-report.json'), JSON.stringify(report, null, 2))
    console.log('PASS: local PTY, SSH, left SFTP, fast directory changes, collapse/reopen, stable session, compact layout')
  } catch (err) {
    console.error(await page.evaluate(() => ({
      text: document.body.innerText,
      active: window.store.activeTabId,
      tabs: window.store.tabs.map(t => ({ id: t.id, status: t.status, type: t.type })),
      sftp: window.testRefs?.get('sftp-' + window.fixtureId)?.state,
      terminal: !!window.testRefs?.get('term-' + window.fixtureId)
    })))
    console.error({ requests, shellCount, errors, data })
    await page.screenshot({ path: path.join(root, '.cache/smoke-failure.png') })
    throw err
  } finally {
    await app.close()
    for (const client of clients) client.end()
    server.close()
  }
}

main().catch(err => {
  console.error(err)
  for (const client of clients) client.end()
  server.close()
  process.exitCode = 1
})
