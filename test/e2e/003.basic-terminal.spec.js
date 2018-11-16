const { Application } = require('spectron')
const electronPath = require('electron')
const {resolve} = require('path')
const cwd = process.cwd()
const os = require('os')
const delay = require('./common/wait')
const basicTermTest = require('./common/basic-terminal-test')
const platform = os.platform()
const isWin = platform.startsWith('win')

describe('terminal', function () {
  this.timeout(100000)

  beforeEach(async function() {
    this.app = new Application({
      path: electronPath,
      webdriverOptions: {
        deprecationWarnings: false
      },
      args: [resolve(cwd, 'work/app'), '--no-session-restore']
    })
    return this.app.start()
  })

  afterEach(function() {
    if (this.app && this.app.isRunning()) {
      return this.app.stop()
    }
  })

  it('should open window and local terminal ls/dir command works', async function() {
    const {client} = this.app
    let cmd = isWin
      ? 'dir'
      : 'ls'
    await client.waitUntilWindowLoaded()
    await delay(500)
    await basicTermTest(this, client, cmd)


  })

})
