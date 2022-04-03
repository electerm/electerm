/**
 * basic ssh test
 * need TEST_HOST TEST_PASS TEST_USER env set
 */

const { _electron: electron } = require('playwright')
const {
  test: it
} = require('@playwright/test')
const { describe } = it
it.setTimeout(100000)
const { expect } = require('chai')
const delay = require('./common/wait')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')

describe('terminal split', function () {
  it('split button works', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(4500)
    await client.click('.ssh-wrap-show .term-controls .icon-split')
    await delay(200)
    let terms = await client.elements('.ssh-wrap-show .term-wrap')
    terms = await terms.count()
    expect(terms).equal(2)
    await client.click('.ssh-wrap-show .term-controls .icon-split')
    await delay(200)
    terms = await client.elements('.ssh-wrap-show .term-wrap')
    terms = await terms.count()
    expect(terms).equal(3)
    await client.click('.ssh-wrap-show .term-controls .icon-trash')
    await delay(200)
    terms = await client.elements('.ssh-wrap-show .term-wrap')
    terms = await terms.count()
    expect(terms).equal(2)
  })
})
