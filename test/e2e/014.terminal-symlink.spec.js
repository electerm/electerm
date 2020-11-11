const { Application } = require('spectron')
const delay = require('./common/wait')
const log = require('./common/log')
const { expect } = require('chai')
const isOs = require('./common/is-os')
const appOptions = require('./common/app-options')

if (isOs('darwin')) {
  return
}

describe('terminal symlink', function () {
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
    const cmd = 'rm -rf tmp-o.js link-o && touch tmp-o.js && ln -s tmp-o.js link-o'
    await client.waitUntilWindowLoaded()
    await delay(3500)
    await client.keys([...cmd.split(''), 'Enter'])

    log('click file manager tab')
    await client.execute(function () {
      document.querySelectorAll('.ssh-wrap-show .term-sftp-tabs .type-tab')[1].click()
    })
    await delay(200)

    log('refresh')
    await client.execute(function () {
      document.querySelector('.sftp-title .anticon-reload').click()
    })
    await delay(800)

    log('check synlink')
    const txt = await client.getText('.sftp-table-content')
    expect(txt.includes('*link-o')).equal(true)
    // await delay(200)
    // expect(has).equal(true)

    // clean
    await client.execute(function () {
      document.querySelectorAll('.ssh-wrap-show .term-sftp-tabs .type-tab')[0].click()
    })

    await delay(200)
    const cmd0 = 'rm -rf tmp-o.js link-o'
    await client.keys([...cmd0.split(''), 'Enter'])
  })
})
