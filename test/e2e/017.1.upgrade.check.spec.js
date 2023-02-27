const { _electron: electron } = require('playwright')
const {
  test: it
} = require('@playwright/test')
const { describe } = it
it.setTimeout(100000)
const delay = require('./common/wait')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')
const log = require('./common/log')
const { expect } = require('chai')

describe('auto upgrade check', function () {
  it('auto upgrade check should work', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    let v = ''
    while (v !== '0.0.0') {
      v = await client.evaluate(() => {
        if (window.et) {
          window.et.version = '0.0.0'
          return '0.0.0'
        }
        return ''
      })
      await delay(10)
    }
    await delay(12500)
    log('should show upgrade info')
    const sel = '.animate.upgrade-panel'
    await client.hasElem(sel)
    log('start download upgrade')
    await client.click('.upgrade-panel .ant-btn-primary')
    await delay(3500)
    const txt = await client.getText('.upgrade-panel .ant-btn-primary')
    console.log('txt', txt)
    expect(txt.includes('Upgrading... 0% Cancel')).equal(false)
    expect(txt.includes('% Cancel')).equal(true)
    await electronApp.close().catch(console.log)
  })
})
