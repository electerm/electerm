const { Application } = require('spectron')
const electronPath = require('electron')
const {resolve} = require('path')
const {expect} = require('chai')
const cwd = process.cwd()
const os = require('os')
const delay = time => new Promise(resolve => setTimeout(resolve, time))
const platform = os.platform()
const isWin = platform.startsWith('win')

describe('ssh', function () {
  this.timeout(100000)

  beforeEach(async function() {
    this.app = new Application({
      path: electronPath,
      args: [resolve(cwd, 'work/app')]
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
    await client.rightClick('#xterm-cursor-layer', 20, 20)

    await delay(101)
    await client.execute(function() {
      document.querySelectorAll('.context-menu .context-item')[3].click()
    })
    await client.rightClick('#xterm-cursor-layer', 20, 20)
    await delay(101)
    await client.execute(function() {
      document.querySelectorAll('.context-menu .context-item')[3].click()
    })
    await delay(101)
    await client.execute(function() {
      document.querySelectorAll('.context-menu .context-item')[0].click()
    })
    let text1 = await this.app.electron.clipboard.readText()
    await delay(101)
    await client.keys([...cmd.split(''), 'Enter'])
    await client.rightClick('#xterm-cursor-layer', 20, 20)

    await delay(101)
    await client.execute(function() {
      document.querySelectorAll('.context-menu .context-item')[3].click()
    })
    await client.rightClick('#xterm-cursor-layer', 20, 20)
    await delay(101)
    await client.execute(function() {
      document.querySelectorAll('.context-menu .context-item')[3].click()
    })
    await delay(101)
    await client.execute(function() {
      document.querySelectorAll('.context-menu .context-item')[0].click()
    })
    let text2 = await this.app.electron.clipboard.readText()
    expect(text1.trim().length * 2).lessThan(text2.trim().length)


  })

})
