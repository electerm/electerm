const { Application } = require('spectron')
const os = require('os')
const delay = require('./common/wait')
const basicTermTest = require('./common/basic-terminal-test')
const platform = os.platform()
const isWin = platform.startsWith('win')
const appOptions = require('./common/app-options')

const isOs = require('./common/is-os')

if (!process.env.LOCAL_TEST && isOs('darwin')) {
  return
}

describe('terminal', function () {
  this.timeout(100000)

  beforeEach(async function () {
    this.app = new Application(appOptions)
    return this.app.start()
  })

  afterEach(function () {
    if (this.app && this.app.isRunning()) {
      return this.app.stop()
    }
  })

  it('should open window and local terminal ls/dir command works', async function () {
    const { client } = this.app
    const cmd = isWin
      ? 'dir'
      : 'ls'
    await client.waitUntilWindowLoaded()
    await delay(7500)
    await basicTermTest(this, client, cmd)
  })
})
