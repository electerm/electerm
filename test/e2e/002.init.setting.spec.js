const { _electron: electron } = require('playwright')
const {
  test: it,
  expect
} = require('@playwright/test')
const { describe } = it
it.setTimeout(100000)

const delay = require('./common/wait')
const log = require('./common/log')
const appOptions = require('./common/app-options')
const prefixer = require('./common/lang')
const extendClient = require('./common/client-extend')

describe('init setting buttons', function () {
  it('all buttons open proper setting tab', async function () {
    const electronApp = await electron.launch(appOptions)
    // const app = await electronApp.evaluate(async ({ app }) => {
    //   // This runs in the main Electron process, parameter here is always
    //   // the result of the require('electron') in the main app script.
    //   return app
    // })
    // console.log(app)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    const prefix = await prefixer()
    const e = prefix('common')
    // await client.waitUntilWindowLoaded()
    await delay(3500)

    log('button:edit')
    await client.click('.btns .anticon-plus-circle')
    await delay(3500)
    const sel = '.setting-wrap .ant-tabs-nav-list .ant-tabs-tab-active'
    const active = await client.element(sel)
    expect(active).toBeVisible()
    const text = await client.getText(sel)
    expect(text).toEqual(e('bookmarks'))

    log('close')
    await client.click('.setting-wrap .close-setting-wrap')
    await delay(900)

    log('open setting')
    await client.click('.btns .anticon-setting')
    await delay(2500)
    const active1 = await client.element(sel)
    expect(active1).toBeVisible()
    const text1 = await client.getText(sel)
    expect(text1).toEqual(e('setting'))
    log('close')
    await client.click('.setting-wrap .close-setting-wrap')
    await delay(900)

    log('button:new ssh')
    await client.click('.btns .anticon-plus-circle')
    await delay(1000)
    const active2 = await client.element(sel)
    expect(active2).toBeVisible()
    const text2 = await client.getText(sel)
    expect(text2).toEqual(e('bookmarks'))

    // log('tab it')
    // await client.click('.setting-wrap .ant-tabs-tab:nth-child(3)')
    // await delay(3100)
    // const text4 = await client.getText(sel)
    // expect(text4).toEqual(e('setting'))
    await client.click('.setting-wrap .close-setting-wrap')
    await delay(600)

    log('button:edit again')
    await client.click('.btns .anticon-plus-circle')
    await delay(600)
    const text5 = await client.getText(sel)
    expect(text5).toEqual(e('bookmarks'))

    await electronApp.close().catch(console.log)
  })
})
