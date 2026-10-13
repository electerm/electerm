const { _electron: electron, test, expect } = require('@playwright/test')
const { execFile } = require('node:child_process')
const { promisify } = require('node:util')
const { mkdtempSync, rmSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join, resolve } = require('node:path')

test('Windows recovers lost titlebar drag regions without stealing button clicks', async () => {
  const testInfo = test.info()
  test.skip(process.platform !== 'win32', 'Windows native caption hit testing')
  test.setTimeout(60000)
  const dataDir = mkdtempSync(join(tmpdir(), 'electerm-titlebar-'))
  const env = { ...process.env, DATA_PATH: dataDir, NODE_TEST: 'yes' }
  delete env.ELECTRON_RUN_AS_NODE
  const app = await electron.launch({
    env,
    executablePath: process.env.ELECTERM_E2E_EXECUTABLE,
    args: [resolve(__dirname, 'common/titlebar-app.js')]
  })
  try {
    const page = await app.firstWindow()
    await page.waitForFunction(() => window.store?.configLoaded)
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].setBounds({ x: 100, y: 100, width: 1062, height: 793 })
    })
    await page.waitForFunction(() => {
      const tabs = document.querySelector('.tabs')
      return tabs && tabs.getBoundingClientRect().right <= window.innerWidth
    })
    const area = page.locator('.tabs .app-drag').first()
    await area.waitFor()
    const geometry = await area.evaluate(element => {
      const rect = element.getBoundingClientRect()
      const tab = element.querySelector('.tab').getBoundingClientRect()
      return {
        blank: { x: rect.x + rect.width / 2, y: rect.y + 20 },
        tab: { x: tab.x + tab.width / 2, y: tab.y + 20 },
        maximize: { x: window.innerWidth - 70, y: 20 },
        viewportWidth: window.innerWidth,
        dpr: window.devicePixelRatio
      }
    })
    const handle = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].getNativeWindowHandle().readBigUInt64LE().toString()
    )
    const hitTest = async point => {
      const { stdout } = await promisify(execFile)('powershell.exe', [
        '-NoProfile', '-File', resolve(__dirname, 'common/window-hit-test.ps1'),
        '-WindowHandle', handle,
        '-X', String(Math.round(point.x * geometry.dpr)),
        '-Y', String(Math.round(point.y * geometry.dpr))
      ], { windowsHide: true })
      return Number(stdout.trim())
    }
    const evidence = []
    evidence.push('Electron ' + await app.evaluate(() => process.versions.electron))
    await expect.poll(() => hitTest(geometry.blank)).toBe(2)
    evidence.push('Initial empty titlebar area: HTCAPTION')
    await expect.poll(() => hitTest(geometry.tab)).toBe(1)

    // Fault injection models a missing native region. The live failure had
    // correct CSS but returned HTCLIENT until a rendered style refresh.
    await area.evaluate(element => { element.style.WebkitAppRegion = 'no-drag' })
    await expect.poll(() => hitTest(geometry.blank)).toBe(1)
    await page.mouse.move(geometry.tab.x, geometry.tab.y)
    expect(await area.evaluate(element => element.style.WebkitAppRegion)).toBe('no-drag')
    expect(await hitTest(geometry.tab)).toBe(1)
    evidence.push('Tab mouse move preserves its no-drag exclusion')

    await page.mouse.move(geometry.blank.x, geometry.blank.y)
    await expect.poll(() => hitTest(geometry.blank), {
      message: 'Moving over an empty titlebar must restore the native window drag region'
    }).toBe(2)
    expect(await hitTest(geometry.tab)).toBe(1)
    expect(await hitTest(geometry.maximize)).toBe(9)
    evidence.push('Empty-area mouse move recovers HTCAPTION; tab remains HTCLIENT')
    evidence.push('Native maximize control remains HTMAXBUTTON')

    const logPath = testInfo.outputPath('native-hit-tests.txt')
    writeFileSync(logPath, evidence.join('\n'))
    const imagePath = testInfo.outputPath('recovered-titlebar.png')
    await page.screenshot({ path: imagePath, clip: { x: 0, y: 0, width: geometry.viewportWidth, height: 36 } })
    await testInfo.attach('native-hit-tests', { path: logPath, contentType: 'text/plain' })
    await testInfo.attach('recovered-titlebar', { path: imagePath, contentType: 'image/png' })
  } finally {
    await app.close()
    rmSync(dataDir, { recursive: true, force: true })
  }
})
