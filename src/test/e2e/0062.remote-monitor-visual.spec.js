/**
 * Deterministic visual/accessibility assertions for remote monitor summaries.
 */

const { _electron: electron, test } = require('@playwright/test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const appOptions = require('./common/app-options')

test.setTimeout(60000)

test('remote monitor styles, panel geometry and mobile overflow', async () => {
  const profileRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-remote-monitor-visual-'))
  const app = await electron.launch({
    ...appOptions,
    args: [...appOptions.args, `--user-data-dir=${profileRoot}`],
    env: {
      ...appOptions.env,
      DATA_PATH: path.join(profileRoot, 'data'),
      XDG_CONFIG_HOME: path.join(profileRoot, 'config')
    }
  })
  try {
    let page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded').catch(() => {})
    const windows = app.windows()
    page = windows[windows.length - 1] || page
    await page.waitForFunction(() => window.store?.configLoaded === true, null, {
      timeout: 30000
    })
    const result = await page.evaluate(() => {
      const root = document.querySelector('#outside-context') || document.body
      const warning = document.createElement('button')
      warning.className = 'remote-monitor-item remote-monitor-level-warning'
      warning.setAttribute('aria-label', 'CPU usage: Warning')
      warning.textContent = 'CPU 82%'
      const critical = document.createElement('button')
      critical.className = 'remote-monitor-item remote-monitor-level-critical'
      critical.setAttribute('aria-label', 'Memory: High usage')
      critical.textContent = 'Mem 92%'
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('class', 'remote-monitor-sparkline remote-monitor-level-critical')
      root.append(warning, critical, svg)
      const styles = {
        warning: window.getComputedStyle(warning).color,
        critical: window.getComputedStyle(critical).color,
        sparkline: window.getComputedStyle(svg).color,
        warningLabel: warning.getAttribute('aria-label'),
        criticalLabel: critical.getAttribute('aria-label')
      }
      warning.remove()
      critical.remove()
      svg.remove()
      return styles
    })
    assert.notEqual(result.warning, result.critical)
    assert.equal(result.critical, result.sparkline)
    assert.match(result.warningLabel, /Warning/)
    assert.match(result.criticalLabel, /High usage/)

    await page.waitForFunction(() => window.store.currentTab?.status === 'success')
    await page.evaluate(() => window.store.openInfoPanel())
    const localInfo = page.locator('.right-side-panel [data-monitor-detail="hostname"]')
    await localInfo.locator('dl').waitFor()
    assert.ok((await localInfo.innerText()).includes('OS'))
    await page.locator('.right-side-panel-close').click()
    await page.evaluate(() => {
      const { store } = window
      store.updateTab(store.activeTabId, { host: 'monitor.invalid', type: 'ssh', status: 'error' })
      store.setConfig({ remoteMonitorBarEnabled: true })
    })
    const bar = page.locator('.remote-monitor-bar')
    await bar.waitFor({ state: 'visible' })
    // Opening an overlay must not move the bar; only desktop pins reserve space.
    for (const width of [1200, 375]) {
      await page.setViewportSize({ width, height: 800 })
      await page.waitForFunction(width => window.store.width === width, width)
      if (width === 375) {
        assert.equal(await bar.evaluate(node => window.getComputedStyle(node).position), 'fixed')
        assert.equal(await page.locator('.main-footer').evaluate(node => window.getComputedStyle(node).position), 'fixed')
      }
      for (const sidebar of [false, true]) {
        for (const pinned of [false, true]) {
          for (const rightPinned of [false, true]) {
            for (const opened of [false, true]) {
              await page.evaluate(({ sidebar, pinned, rightPinned, opened }) => {
                Object.assign(window.store, {
                  _leftSideBarOpen: sidebar,
                  _leftSidePanelWidth: 257,
                  _rightPanelWidth: 411,
                  pinned,
                  openedSideBar: opened ? 'bookmarks' : '',
                  rightPanelTab: 'ai',
                  rightPanelPinned: rightPinned,
                  rightPanelVisible: opened
                })
              }, { sidebar, pinned, rightPinned, opened })
              await page.waitForFunction(() => {
                const { store } = window
                const monitor = document.querySelector('.remote-monitor-bar').getBoundingClientRect()
                const terminal = document.querySelector('.sessions').getBoundingClientRect()
                const left = store.leftSideBarWidth + (!store.isMobile && store.pinned ? store.leftSidePanelWidth : 0)
                const right = !store.isMobile && store.rightPanelPinned && store.rightPanelVisible ? store.rightPanelWidth : 0
                return Math.abs(monitor.left - left) < 1 &&
                  Math.abs(monitor.right - (store.width - right)) < 1 &&
                  Math.abs(monitor.left - terminal.left) < 1 &&
                  Math.abs(monitor.width - terminal.width) < 1
              })
            }
          }
        }
      }
    }
    await page.evaluate(() => {
      window.store.rightPanelVisible = false
      window.store.showAIConfigModal = false
      window.store.pinned = false
      window.store.openedSideBar = ''
      window.store._leftSideBarOpen = false
    })
    assert.equal(await bar.locator('.remote-monitor-controls').evaluate(node => window.getComputedStyle(node).opacity), '1')
    await page.evaluate(() => window.store.toggleSessFullscreen(true))
    await page.waitForFunction(() => {
      const bounds = document.querySelector('.remote-monitor-bar').getBoundingClientRect()
      return bounds.left === 0 && bounds.width === window.innerWidth
    })
    await page.evaluate(() => {
      document.body.classList.add('shortcut-bar-on')
      document.documentElement.style.setProperty('--shortcut-bar-h', '44px')
      document.documentElement.style.setProperty('--shortcut-bar-kb-offset', '240px')
    })
    await page.waitForFunction(() => {
      const monitor = document.querySelector('.remote-monitor-bar').getBoundingClientRect()
      const terminal = document.querySelector('.session-current .term-wrap').getBoundingClientRect()
      const footer = document.querySelector('.main-footer').getBoundingClientRect()
      return Math.abs(monitor.bottom - footer.top) < 1 && Math.abs(terminal.bottom - monitor.top) < 1
    })
    await page.evaluate(() => {
      document.body.classList.remove('shortcut-bar-on')
      document.documentElement.style.removeProperty('--shortcut-bar-h')
      document.documentElement.style.removeProperty('--shortcut-bar-kb-offset')
      window.store.toggleSessFullscreen(false)
      window.store.updateTab(window.store.activeTabId, { status: 'success' })
    })
    await bar.locator('.remote-monitor-item-hostname').click()
    const popover = page.locator('.remote-monitor-popover:visible')
    await popover.waitFor()
    await page.screenshot({ path: test.info().outputPath('remote-monitor-mobile.png') })
    const popupBounds = await popover.boundingBox()
    assert.ok(popupBounds.x >= 0 && popupBounds.x + popupBounds.width <= 375)
    const tooltipRows = await popover.locator('dl').innerText()
    const terminalHeight = (await page.locator('.sessions').boundingBox()).height
    await popover.locator('.ant-btn-link').click()
    await bar.waitFor({ state: 'hidden' })
    const panel = page.locator('.right-side-panel')
    await panel.locator('[data-monitor-detail="hostname"]').waitFor()
    await panel.locator('[data-monitor-detail="cpu"]').waitFor()
    assert.equal(await panel.locator('[data-monitor-detail="hostname"] dl').innerText(), tooltipRows)
    assert.equal((await page.locator('.sessions').boundingBox()).height, terminalHeight + 28)
    assert.equal(await panel.locator('[data-monitor-detail="memory"]').count(), 1)
    assert.equal(await panel.locator('[data-monitor-detail="swap"]').count(), 0)
    await page.evaluate(() => window.store.setConfig({ hideIP: true }))
    await page.waitForFunction(() => !document.querySelector('.right-side-panel [data-monitor-detail="hostname"]').textContent.includes('monitor.invalid'))
    assert.equal(await page.evaluate(() => window.store.config.remoteMonitorBarEnabled), true)
    await page.locator('.right-side-panel-close').click()
    await bar.waitFor({ state: 'visible' })
    await bar.locator('.remote-monitor-controls .item-filter').click()
    const filterList = page.locator('.item-filter-list:visible')
    await filterList.waitFor()
    const filterBounds = await filterList.boundingBox()
    assert.ok(filterBounds.x >= 0 && filterBounds.x + filterBounds.width <= 375)
  } finally {
    await app.close().catch(() => {})
    fs.rmSync(profileRoot, { recursive: true, force: true })
  }
})
