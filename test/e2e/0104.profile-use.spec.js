/**
 * ssh profile login test
 */
const { _electron: electron } = require('@playwright/test')
const {
  test: it
} = require('@playwright/test')
const { describe } = it
it.setTimeout(100000)
const { expect } = require('./common/expect')
const delay = require('./common/wait')
const log = require('./common/log')
const {
  TEST_HOST,
  TEST_PASS,
  TEST_USER
} = require('./common/env')
const uid = require('./common/uid')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')
const { basicTerminalTest } = require('./common/basic-terminal-test')

describe('ssh profile login', function () {
  it('should create profile and login using it', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(3500)

    // First create an SSH connection to get proper tab data
    await client.click('.btns .anticon-plus-circle')
    log('0104.profile-use.spec.js: plus clicked')
    await delay(500)
    await client.setValue('#ssh-form_host', TEST_HOST)
    await client.setValue('#ssh-form_username', TEST_USER)
    await client.setValue('#ssh-form_password', TEST_PASS)
    await client.click('.setting-wrap .ant-btn-primary')
    log('0104.profile-use.spec.js: ssh form submitted')
    await delay(5500)
    log('0104.profile-use.spec.js: ssh connected')

    // Get the SSH tab data
    const sshTab = await client.evaluate(() => {
      return window.store.tabs[window.store.tabs.length - 1]
    })
    log('0104.profile-use.spec.js: ssh tab data retrieved')

    // Create profile
    await client.click('.btns .anticon-setting')
    log('0104.profile-use.spec.js: setting opened')
    await delay(2500)
    await client.click('.setting-tabs [role="tab"]', 4)
    log('0104.profile-use.spec.js: profiles tab clicked')
    await delay(500)

    const profileName = 'Test-Profile-' + uid()
    await client.setValue('.setting-tabs-profile input#name', profileName)
    log('0104.profile-use.spec.js: profile name set')
    await client.setValue('.setting-tabs-profile input#password', TEST_PASS)
    await client.setValue('.setting-tabs-profile input#username', TEST_USER)
    await delay(150)

    const profileCountPrev = await client.evaluate(() => {
      return window.store.profiles.length
    })
    await client.click('.setting-tabs-profile .ant-btn-primary')
    log('0104.profile-use.spec.js: profile save clicked')
    await delay(2550)

    // Verify profile was created
    const profileCount = await client.evaluate(() => {
      return window.store.profiles.length
    })
    expect(profileCount).equal(profileCountPrev + 1)
    log('0104.profile-use.spec.js: profile created')

    // Get profile ID and create tab with it
    await client.evaluate((data) => {
      window.store.showModal = 0
    })
    await client.evaluate((data) => {
      const profile = window.store.profiles.find(p => p.name === data.name)
      const nt = {
        ...data.tab,
        id: 'sdfdsf',
        pid: '',
        profile: profile.id
      }
      nt.authType = 'profiles'
      delete nt.password
      window.store.addTab(nt)
    }, {
      name: profileName,
      tab: sshTab
    })
    log('0104.profile-use.spec.js: tab with profile added')
    await delay(5500)

    // Verify connection works
    await basicTerminalTest(client, 'ls')
    log('0104.profile-use.spec.js: basic terminal test done')

    await electronApp.close().catch(console.log)
    log('0104.profile-use.spec.js: app closed')
  })
})
