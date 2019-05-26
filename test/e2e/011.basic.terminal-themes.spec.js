const { Application } = require('spectron')
const delay = require('./common/wait')
const _ = require('lodash')
const log = require('./common/log')
const { expect } = require('chai')
const appOptions = require('./common/app-options')

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
    let { lang } = await electron.remote.getGlobal('et')
    let prefix = prefix => {
      return (id) => {
        return _.get(lang, `${prefix}.${id}`) || id
      }
    }
    let e = prefix('common')
    let t = prefix('terminalThemes')
    await client.waitUntilWindowLoaded()
    await delay(500)

    log('button:edit')
    await client.click('.btns .anticon-picture')
    await delay(500)
    let sel = '.ant-modal .ant-tabs-line > .ant-tabs-bar .ant-tabs-tab-active'
    let active = await client.element(sel)
    expect(!!active.value).equal(true)
    let text = await client.getText(sel)
    expect(text).equal(t('terminalThemes'))

    let v = await client.getValue('.ant-modal #themeName')
    let tx = await client.getText('.ant-modal .item-list-unit.active')
    let txd = await client.getText('.ant-modal .item-list-unit.current')
    expect(v).equal(t('newTheme'))
    expect(tx).equal(t('newTheme'))
    expect(txd).equal(t('default'))

    log('tab it')
    await client.execute(function () {
      document.querySelectorAll('.ant-modal .ant-tabs-tab')[2].click()
    })
    await delay(100)
    let text4 = await client.getText(sel)
    expect(text4).equal(e('setting'))
  })
})
