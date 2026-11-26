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
    // Exercise the unpackaged download path with a main-process version newer
    // than the offered release. The test-mode shortcut would mask this case.
    await electronApp.evaluate(({ app }) => {
      if (app.isPackaged) throw new Error('Expected an unpackaged test app')
      delete process.env.NODE_TEST
      app.getVersion = () => '999.0.0'
    })
    const previousLanguage = await client.evaluate(() => {
      const previous = window.store.config.language
      window.store.setConfig({ language: 'fr_fr' })
      return previous
    })
    const [progress] = await Promise.all([
      electronApp.waitForEvent('window'),
      client.click('.upgrade-panel .ant-btn-primary')
    ])
    await progress.getByRole('button', { name: 'Annuler' }).waitFor()
    await progress.waitForFunction(() => document.documentElement.lang === 'fr-fr')
    await progress.waitForFunction(() => document.querySelector('progress')?.value > 0)
    await Promise.all([
      progress.waitForEvent('close'),
      progress.getByRole('button', { name: 'Annuler' }).evaluate(button => { setTimeout(() => button.click(), 0) })
    ])
    await client.evaluate(language => window.store.setConfig({ language }), previousLanguage)
    await electronApp.close().catch(console.log)
  })
})
