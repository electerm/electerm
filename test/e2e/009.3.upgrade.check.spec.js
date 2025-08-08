const { _electron: electron } = require('@playwright/test')
const {
  test: it
} = require('@playwright/test')
const { describe } = it
it.setTimeout(100000)
const delay = require('./common/wait')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')
const log = require('./common/log')
const { expect } = require('./common/expect')

describe('auto upgrade check', function () {
  it('auto upgrade check should work', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    let v = ''
    while (v !== '0.0.0') {
      v = await client.evaluate(() => {
        if (window.et) {
          console.log('no retry set version')
          window.et.version = '0.0.0'
          return '0.0.0'
        }
        console.log('retry set version')
        return ''
      })
      await delay(2)
    }
    console.log('v', v)
    const len1 = 10000
    const sel = '.animate.upgrade-panel'
    for (let i = 0; i < len1; i++) {
      await delay(500)
      if (await client.elemExist(sel)) {
        break
      }
    }
    log('should show upgrade info')
    log('start download upgrade')
    await client.click('.upgrade-panel .ant-btn-primary')
    const fr = {}
    const len = 200
    for (let i = 0; i < len; i++) {
      await delay(500)
      const txt = await client.getText('.upgrade-panel .ant-btn-primary')
      console.log('txt', txt)
      if (txt.includes('Upgrading... 0% Cancel')) {
        fr.zero = 1
      } else if (
        txt.includes('% Cancel')
      ) {
        fr.progress = 1
      }
      if (fr.zero && fr.progress) {
        break
      }
    }
    expect(fr.progress).equal(1)
    expect(fr.zero).equal(1)
    await electronApp.close().catch(console.log)
  })
})
