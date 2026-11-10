const { _electron: electron, test, expect } = require('@playwright/test')
const { mkdtempSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join, resolve } = require('node:path')

test('the full tab close button closes exactly one tab', async () => {
  test.setTimeout(60000)
  const dataDir = mkdtempSync(join(tmpdir(), 'electerm-tab-close-'))
  const env = { ...process.env, DATA_PATH: dataDir, NODE_TEST: 'yes' }
  // 从 electerm 终端运行测试时，不能继承宿主后端及会话服务的端口。
  for (const key of ['ELECTRON_RUN_AS_NODE', 'electermPort', 'electermHost', 'tokenElecterm', 'requireAuth', 'wsPort', 'type']) {
    delete env[key]
  }
  if (process.platform === 'linux') {
    env.ELECTRON_DISABLE_SANDBOX = '1'
  }
  const app = await electron.launch({
    env,
    args: [
      resolve(__dirname, 'common/titlebar-app.js'),
      ...(process.platform === 'linux' ? ['--no-sandbox'] : [])
    ]
  })
  let stderr = ''
  app.process().stderr.on('data', data => { stderr += data.toString() })
  try {
    const page = await app.firstWindow()
    await page.waitForFunction(() => window.store?.configLoaded && window.store.tabs.length, undefined, { timeout: 10000 }).catch(error => {
      throw new Error(`${error.message}\n${stderr}`)
    })
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].setBounds({ x: 100, y: 100, width: 1100, height: 740 })
    })
    await page.evaluate(() => {
      window.store.config.switchTabOnHover = false
      for (let i = 0; i < 7; i++) {
        window.store.addTab()
      }
      window.store.tabs.forEach(tab => {
        window.store.updateTab(tab.id, { title: 'tab close hit area regression '.repeat(3) })
      })
    })
    await expect(page.locator('.v1 .tab')).toHaveCount(8)
    await expect(page.locator('.v1 .tab-scroll-icon')).toHaveCount(2)

    const points = [
      ['left edge', 1, 8],
      ['top edge', 8, 1],
      ['right edge', 15, 8],
      ['bottom edge', 8, 15],
      ['center', 8, 8]
    ]
    for (const [name, x, y] of points) {
      await test.step(name, async () => {
        const tab = page.locator('.v1 .tab').last()
        await tab.hover()
        const id = await tab.getAttribute('data-id')
        const count = await page.locator('.v1 .tab').count()
        // 使用相对按钮的真实坐标，不能用 DOM click 绕过命中测试。
        await tab.locator('.tab-close').click({ position: { x, y } })
        await expect(page.locator(`.v1 .tab[data-id="${id}"]`)).toHaveCount(0)
        await expect(page.locator('.v1 .tab')).toHaveCount(count - 1)
      })
    }
  } finally {
    await app.close()
    rmSync(dataDir, { recursive: true, force: true })
  }
})
