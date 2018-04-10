/**
 * basic ssh test
 * need TEST_HOST TEST_PASS TEST_USER env set
 */

const {
  TEST_HOST,
  TEST_PASS,
  TEST_USER
} = process.env

if (!TEST_HOST || !TEST_PASS || !TEST_USER) {
  throw new Error(`
    basic sftp test need TEST_HOST TEST_PASS TEST_USER env set,
    you can run theselines(replace xxxx with real ones) to set env:
    export TEST_HOST=xxxx.xxx && export TEST_PASS=xxxxxx && export TEST_USER=xxxxxx
  `)
}

const { Application } = require('spectron')
const electronPath = require('electron')
const {resolve} = require('path')
const {expect} = require('chai')
const cwd = process.cwd()
const delay = require('./common/wait')

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

  it('split button works', async function() {
    const {client} = this.app

    await client.waitUntilWindowLoaded()
    await delay(500)
    await client.execute(function() {
      document.querySelector('.ssh-wrap-show .term-controls .icon-split').click()
    })
    await delay(200)
    let terms = await client.elements('.ssh-wrap-show .term-wrap')
    expect(terms.value.length).equal(2)
    await client.execute(function() {
      document.querySelector('.ssh-wrap-show .term-controls .icon-split').click()
    })
    await delay(200)
    terms = await client.elements('.ssh-wrap-show .term-wrap')
    expect(terms.value.length).equal(3)
    await client.execute(function() {
      document.querySelector('.ssh-wrap-show .term-controls .icon-trash').click()
    })
    await delay(200)
    terms = await client.elements('.ssh-wrap-show .term-wrap')
    expect(terms.value.length).equal(2)
  })

})

