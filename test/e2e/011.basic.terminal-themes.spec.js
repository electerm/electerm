const { Application } = require('spectron')
const delay = require('./common/wait')
const log = require('./common/log')
const { expect } = require('chai')
const appOptions = require('./common/app-options')
const prefixer = require('./common/lang')
const extendClient = require('./common/client-extend')

describe('terminal themes', function () {
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

  it('all buttons open proper terminal themes tab', async function () {
    const { client, electron } = this.app
    extendClient(client)
    const prefix = await prefixer(electron)
    const e = prefix('common')
    const t = prefix('terminalThemes')
    await client.waitUntilWindowLoaded()
    await delay(1500)

    log('button:edit')
    await client.click('.btns .anticon-picture')
    await delay(500)
    const sel = '.setting-wrap .ant-tabs-nav-list .ant-tabs-tab-active'
    const active = await client.element(sel)
    await delay(2500)
    expect(!!active.elementId).equal(true)
    const text = await client.getText(sel)
    expect(text).equal(t('uiThemes'))

    const v = await client.getValue('.setting-wrap #terminal-theme-form_themeName')
    const tx = await client.getText('.setting-wrap .item-list-unit.active')
    const txd = await client.getText('.setting-wrap .item-list-unit.current')
    expect(v).equal(t('newTheme'))
    expect(tx).equal(t('newTheme'))
    expect(txd).equal(t('default'))

    log('tab it')
    await client.execute(function () {
      document.querySelectorAll('.setting-wrap .ant-tabs-tab')[2].click()
    })
    await delay(100)
    const text4 = await client.getText(sel)
    expect(text4).equal(e('setting'))
  })
})
