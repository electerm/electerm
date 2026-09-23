/**
 * temporary debug spec (not part of the suite)
 */
const { _electron: electron, test: it } = require('@playwright/test')
const { describe } = it
it.setTimeout(500000)
const delay = require('./common/wait')
const log = require('./common/log')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')
const {
  setupSshConnection
} = require('./common/common')
const nanoid = require('./common/uid')
const { getTerminalContent } = require('./common/basic-terminal-test')

describe('debug', function () {
  it('inspect sftp + terminal state', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)

    client.on('console', m => log('[console:' + m.type() + '] ' + m.text().slice(0, 300)))
    client.on('pageerror', e => log('[pageerror] ' + e.message.slice(0, 300)))
    electronApp.process().stderr.on('data', d => {
      const s = d.toString().trim()
      if (s) log('[stderr] ' + s.slice(0, 300))
    })

    await delay(4500)

    const dump = async (tag) => {
      const info = await client.evaluate(() => {
        const read = (sel) => {
          const el = document.querySelector(sel)
          if (!el) return null
          const content = el.querySelector('.sftp-table-content')
          return {
            contentH: content ? content.clientHeight : null,
            contentScrollH: content ? content.scrollHeight : null,
            items: el.querySelectorAll('.sftp-item').length,
            realItems: el.querySelectorAll('.real-file-item').length,
            parent: el.querySelectorAll('.parent-file-item').length,
            titles: Array.from(el.querySelectorAll('.sftp-item')).slice(0, 15).map(d => d.getAttribute('title'))
          }
        }
        return {
          win: { w: window.innerWidth, h: window.innerHeight, dw: window.screen.width, dh: window.screen.height },
          local: read('.session-current .file-list.local'),
          remote: read('.session-current .file-list.remote'),
          addr: Array.from(document.querySelectorAll('.sftp-panel-title')).map(d => d.innerText),
          pathInputs: Array.from(document.querySelectorAll('.session-current .sftp-title-wrap input, .session-current .address-bar input')).map(d => d.value),
          notices: Array.from(document.querySelectorAll('.ant-notification-notice')).map(d => d.innerText.slice(0, 200))
        }
      })
      log(`===== ${tag} =====`)
      log(JSON.stringify(info, null, 1).slice(0, 3000))
    }

    // 1. ssh terminal
    await setupSshConnection(client)
    await delay(6000)
    const termText = await getTerminalContent(client)
    log('===== terminal content =====')
    log(JSON.stringify(termText.slice(0, 1500)))

    // 2. sftp tab
    await client.click('.session-current .term-sftp-tabs .type-tab', 1)
    await delay(3000)
    await dump('after-connect')

    // 3. create local folder
    const fname = '00000test-electerm' + nanoid()
    log('creating local folder ' + fname)
    try {
      await client.rightClick('.session-current .file-list.local .parent-file-item', 10, 10)
      await delay(800)
      await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("New Folder")')
      await delay(600)
      const inputCount = await client.locator('.session-current .sftp-item input').count()
      log('new item input count: ' + inputCount)
      await client.setValue('.session-current .sftp-item input', fname)
      await client.click('.session-current .sftp-panel-title')
      await delay(3500)
    } catch (err) {
      log('create folder error: ' + err.message.slice(0, 300))
    }
    await dump('after-create-local')
    log('local folder exists: ' + await client.locator(`.session-current .file-list.local .sftp-item[title="${fname}"]`).count())

    // 4. create remote folder
    const rname = '00000test-electerm' + nanoid()
    log('creating remote folder ' + rname)
    try {
      await client.rightClick('.session-current .file-list.remote .parent-file-item', 10, 10)
      await delay(800)
      await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("New Folder")')
      await delay(600)
      await client.setValue('.session-current .file-list.remote .sftp-item input', rname)
      await client.click('.session-current .sftp-panel-title')
      await delay(3500)
    } catch (err) {
      log('create remote folder error: ' + err.message.slice(0, 300))
    }
    await dump('after-create-remote')
    log('remote folder exists: ' + await client.locator(`.session-current .file-list.remote .sftp-item[title="${rname}"]`).count())

    await client.screenshot({ path: '/tmp/ci-debug.png', fullPage: false }).catch(() => {})
    await electronApp.close().catch(console.log)
  })
})
