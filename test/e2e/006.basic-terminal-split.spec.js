/**
 * basic ssh test
 * need TEST_HOST TEST_PASS TEST_USER env set
 */

const { Application } = require('spectron')
const { expect } = require('chai')
const delay = require('./common/wait')
const appOptions = require('./common/app-options')

describe('terminal split', function () {
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

  it('split button works', async function () {
    const { client } = this.app

    await client.waitUntilWindowLoaded()
    await delay(500)
    await client.execute(function () {
      document.querySelector('.ssh-wrap-show .term-controls .icon-split').click()
    })
    await delay(200)
    let terms = await client.elements('.ssh-wrap-show .term-wrap')
    expect(terms.value.length).equal(2)
    await client.execute(function () {
      document.querySelector('.ssh-wrap-show .term-controls .icon-split').click()
    })
    await delay(200)
    terms = await client.elements('.ssh-wrap-show .term-wrap')
    expect(terms.value.length).equal(3)
    await client.execute(function () {
      document.querySelector('.ssh-wrap-show .term-controls .icon-trash').click()
    })
    await delay(200)
    terms = await client.elements('.ssh-wrap-show .term-wrap')
    expect(terms.value.length).equal(2)
  })
})
