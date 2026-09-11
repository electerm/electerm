/**
 * Failure diagnostics for e2e tests.
 * Dumps window/session/file-list state to the CI log and saves a screenshot
 * under test-results/ (uploaded as an artifact by the CI workflow on failure).
 * All steps are best-effort and never throw.
 */
const delay = require('./wait')
const log = require('./log')

async function diagnose (client, tag) {
  const safeTag = String(tag).replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 80)
  try {
    const info = await client.evaluate(() => {
      const q = (sel) => document.querySelectorAll(sel).length
      const firstTitles = (sel, n = 8) => Array.from(document.querySelectorAll(sel)).slice(0, n).map((d) => d.getAttribute('title'))
      const termEl = document.querySelector('.session-current .term-wrap .xterm-screen')
      const termText = termEl ? (termEl.textContent || '') : ''
      const active = document.activeElement
      const localList = document.querySelector('.session-current .file-list.local')
      const remoteList = document.querySelector('.session-current .file-list.remote')
      const openMenu = document.querySelector('.ant-dropdown:not(.ant-dropdown-hidden)')
      return {
        win: { w: window.innerWidth, h: window.innerHeight },
        sessionCurrent: q('.session-current'),
        termWrap: q('.session-current .term-wrap'),
        termTextLen: termText.length,
        termHead: termText.slice(0, 400),
        termTail: termText.slice(-400),
        activeTag: active ? active.tagName + (active.className ? '.' + String(active.className).slice(0, 60) : '') : null,
        localItems: q('.session-current .file-list.local .sftp-item'),
        localReal: q('.session-current .file-list.local .real-file-item'),
        localParent: q('.session-current .file-list.local .parent-file-item'),
        remoteItems: q('.session-current .file-list.remote .sftp-item'),
        remoteReal: q('.session-current .file-list.remote .real-file-item'),
        remoteParent: q('.session-current .file-list.remote .parent-file-item'),
        dropdowns: q('.ant-dropdown:not(.ant-dropdown-hidden)'),
        menuItems: openMenu
          ? Array.from(openMenu.querySelectorAll('.ant-dropdown-menu-item, .ant-dropdown-menu-submenu-title')).map((d) => (d.innerText || '').slice(0, 40))
          : null,
        notices: Array.from(document.querySelectorAll('.ant-notification-notice')).map((d) => (d.innerText || '').slice(0, 200)),
        localSample: firstTitles('.session-current .file-list.local .sftp-item'),
        remoteSample: firstTitles('.session-current .file-list.remote .sftp-item'),
        localHtml: localList ? localList.innerHTML.slice(0, 600) : null,
        remoteHtml: remoteList ? remoteList.innerHTML.slice(0, 600) : null,
        tabs: q('.tabs .tabs-wrapper .tab')
      }
    })
    log(`[diagnose:${safeTag}]`, JSON.stringify(info).slice(0, 2000))
  } catch (e) {
    log(`[diagnose:${safeTag}] evaluate failed:`, ((e && e.message) || e || '').toString().slice(0, 200))
  }
  try {
    await delay(200)
    await client.screenshot({ path: `test-results/diag-${safeTag}-${Date.now()}.png` })
  } catch (e) {
    // ignore
  }
}

module.exports = diagnose
