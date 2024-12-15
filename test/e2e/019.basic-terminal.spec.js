const { _electron: electron } = require('@playwright/test')
const {
  test: it
} = require('@playwright/test')
const { describe } = it
it.setTimeout(100000)
const os = require('os')
const delay = require('./common/wait')
const { basicTerminalTest } = require('./common/basic-terminal-test')
const platform = os.platform()
const isWin = platform.startsWith('win')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')
// if (!process.env.LOCAL_TEST && isOs('darwin')) {
//   return
// }

describe('terminal', function () {
  it('should open window and local terminal ls/dir command works', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    const cmd = isWin
      ? 'dir'
      : 'ls'
    await delay(13500)
    await basicTerminalTest(client, cmd)
    await electronApp.close().catch(console.log)
  })
})
