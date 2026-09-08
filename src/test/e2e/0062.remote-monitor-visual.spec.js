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

test('remote monitor warning styles and sparkline respect semantic states', async () => {
  const profileRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-remote-monitor-visual-'))
  const app = await electron.launch({
    ...appOptions,
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
  } finally {
    await app.close().catch(() => {})
    fs.rmSync(profileRoot, { recursive: true, force: true })
  }
})
