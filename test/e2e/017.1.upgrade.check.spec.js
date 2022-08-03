const { _electron: electron } = require('playwright')
const {
  test: it
} = require('@playwright/test')
const { describe } = it
it.setTimeout(100000)
const delay = require('./common/wait')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')

describe('auto upgrade check', function () {
  it('auto upgrade check should work', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(6500)
    let v = ''
    while (v !== '0.0.0') {
      v = await client.evaluate(() => {
        if (window.et) {
          window.et.version = '0.0.0'
          return '0.0.0'
        }
        return ''
      })
      await delay(50)
    }
    await delay(5500)
    const sel = '.animate.upgrade-panel'
    await client.hasElem(sel)
    await electronApp.close().catch(console.log)
  })
})
