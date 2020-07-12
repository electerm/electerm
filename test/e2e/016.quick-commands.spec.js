/**
 * quick commands test
 * need TEST_HOST TEST_PASS TEST_USER env set
 */

const { Application } = require('spectron')
const { expect } = require('chai')
const delay = require('./common/wait')
const log = require('./common/log')
const appOptions = require('./common/app-options')

describe('quick commands', function () {
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

  it('quick commands form', async function () {
    const { client } = this.app

    await client.waitUntilWindowLoaded()

    log('open setting')
    await delay(1000)
    await client.execute(function () {
      document.querySelector('.btns .anticon-setting').click()
    })
    await delay(1500)
    log('click quick commands')
    await client.execute(function () {
      document.querySelectorAll('.setting-tabs [role="tab"]')[4].click()
    })

    client.setValue(
      '.setting-tabs-quick-commands input[autofocustrigger]',
      'ls'
    )
    client.setValue(
      '.setting-tabs-quick-commands textarea',
      'ls'
    )
    const qmlist1 = await client.elements('.setting-tabs-quick-commands .item-list-unit')
    await delay(150)
    await client.click('.setting-tabs-quick-commands .ant-btn')
    await delay(2550)
    const qmlist2 = await client.elements('.setting-tabs-quick-commands .item-list-unit')
    log(qmlist2.value.length)
    expect(qmlist2.value.length).equal(qmlist1.value.length + 1)
  })
})
