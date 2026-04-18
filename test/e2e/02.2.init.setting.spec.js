const { _electron: electron } = require('@playwright/test')
const {
  test: it,
  expect
} = require('@playwright/test')
const { describe } = it
it.setTimeout(100000)

const delay = require('./common/wait')
const log = require('./common/log')
const appOptions = require('./common/app-options')
const e = require('./common/lang')
const extendClient = require('./common/client-extend')

describe('init setting buttons', function () {
  it('all buttons open proper setting tab', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    // await client.waitUntilWindowLoaded()
    await delay(3500)
    log('close current tab')
    await client.hover('.tabs .tab')
    await client.click('.tabs .tab .tab-close')
    await delay(1000)

    log('verify tab count')
    const tabCount = await client.countElem('.tabs .tab')
    expect(tabCount).toEqual(0)

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
