const { _electron: electron } = require('@playwright/test')
const {
  test: it
} = require('@playwright/test')
const { describe } = it
it.setTimeout(100000)
const delay = require('./common/wait')
const log = require('./common/log')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')

describe('Upgrade check', function () {
  it('Upgrade check should work', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(4500)

    log('button:about')
    await client.click('.btns .open-about-icon')
    await delay(2500)
    const sel = '.ant-modal .ant-tabs-nav-list .ant-tabs-tab-active'
    await client.hasElem(sel)

    await client.click('.about-wrap .ant-btn-primary')
    await delay(9000)
    await client.hasElem('.upgrade-panel')
    await electronApp.close().catch(console.log)
  })
})
