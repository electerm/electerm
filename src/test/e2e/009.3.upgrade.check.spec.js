const { _electron: electron } = require('@playwright/test')
const {
  test: it
} = require('@playwright/test')
const { describe } = it
it.setTimeout(100000)
const appOptions = require('./common/app-options')

describe('auto upgrade check', function () {
  it('auto upgrade check should work', async function () {
    const electronApp = await electron.launch({
      ...appOptions,
      args: [
        ...appOptions.args.filter(arg => !arg.startsWith('--user-data-dir=')),
        `--user-data-dir=${it.info().outputPath('profile')}`
      ],
      env: { ...appOptions.env, DATA_PATH: it.info().outputPath('data') }
    })
    try {
      const client = await electronApp.firstWindow()
      await client.waitForFunction(() => {
        if (!window.et) return false
        window.et.version = '0.0.0'
        return true
      })
      await client.locator('.animate.upgrade-panel').waitFor()
      // Exercise the unpackaged download path with a main-process version newer
      // than the offered release. The test-mode shortcut would mask this case.
      await electronApp.evaluate(({ app }) => {
        if (app.isPackaged) throw new Error('Expected an unpackaged test app')
        delete process.env.NODE_TEST
        app.getVersion = () => '999.0.0'
      })
      await client.evaluate(() => {
        window.store.setConfig({ language: 'fr_fr' })
        // Reproduce a version read from the newline-terminated fallback feed.
        window.store.upgradeInfo.remoteVersion += '\n'
      })
      const [progress] = await Promise.all([
        electronApp.waitForEvent('window'),
        client.click('.upgrade-panel .ant-btn-primary')
      ])
      const cancel = progress.getByRole('button', { name: 'Annuler' })
      await cancel.waitFor()
      await progress.waitForFunction(() => document.documentElement.lang === 'fr-fr')
      await progress.waitForFunction(() => document.querySelector('progress')?.value > 0)
      await Promise.all([
        progress.waitForEvent('close'),
        cancel.evaluate(button => { setTimeout(() => button.click(), 0) })
      ])
    } finally {
      await electronApp.close()
    }
  })
})
