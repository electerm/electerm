const { _electron: electron } = require('@playwright/test')
const {
  test: it
} = require('@playwright/test')
const { describe } = it
it.setTimeout(100000)
const delay = require('./common/wait')
const log = require('./common/log')
const { expect } = require('./common/expect')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')
const { spawn } = require('child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('path')

describe('AI Create Quick Command', function () {
  let aiServer

  it.beforeAll(async () => {
    const serverPath = path.join(__dirname, 'common', 'ai-api.js')
    aiServer = spawn('node', [serverPath])
    await new Promise(resolve => setTimeout(resolve, 1000))
  })

  it.afterAll(() => {
    if (aiServer) {
      aiServer.kill()
    }
  })

  it('should create a quick command with AI in the quick command form', async function () {
    // isolated profile: the quick command generated here must not leak into
    // other runs, and the profile own http cache can not serve a stale bundle
    const profileRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-qm-ai-'))
    const electronApp = await electron.launch({
      ...appOptions,
      args: [...appOptions.args, `--user-data-dir=${profileRoot}`],
      env: {
        ...appOptions.env,
        DATA_PATH: path.join(profileRoot, 'data'),
        XDG_CONFIG_HOME: path.join(profileRoot, 'config')
      }
    })
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(5500)

    log('configure AI')
    await client.evaluate(() => {
      return window.store.setConfig({
        nameAI: 'test',
        modelAI: 'gpt-3.5-turbo',
        baseURLAI: 'http://localhost:43434',
        apiPathAI: '/chat/completions',
        apiKeyAI: 'test-api-key',
        roleAI: 'You are a helpful assistant',
        authHeaderNameAI: 'Authorization: Bearer',
        languageAI: 'English'
      })
    })
    await delay(500)

    log('open quick commands setting')
    await client.evaluate(() => {
      return window.store.handleOpenQuickCommandsSetting()
    })
    await delay(2500)
    await client.hasElem('.setting-tabs-quick-commands')

    log('verify the create with AI tab')
    await client.hasElem('.qm-form-tabs')
    const tabCount = await client.countElem('.qm-form-tabs .ant-tabs-tab')
    expect(tabCount).equal(2)
    await client.hasElem('.qm-ai-editor', false)

    log('switch to the create with AI tab')
    await client.click('.qm-form-tabs .ant-tabs-tab', 1)
    await delay(500)
    await client.hasElem('.qm-ai-editor')

    log('describe the quick command and generate it')
    await client.setValue('.qm-ai-editor textarea', 'list files and show disk usage')
    await client.click('.qm-ai-editor .ant-btn-primary')
    await delay(2000)

    log('generated quick command should be written back into the form')
    await client.hasElem('.qm-ai-editor', false)
    const name = await client.getValue('#name')
    expect(name).equal('Test Quick Command')
    const rowCount = await client.countElem('.qm-cmd-row')
    expect(rowCount).equal(2)
    const firstName = await client.getValue('#commands_0_name')
    expect(firstName).equal('list')
    const firstCmd = await client.getValue('#commands_0_command')
    expect(firstCmd).equal('ls -al')
    const secondCmd = await client.getValue('#commands_1_command')
    expect(secondCmd).equal('df -h')

    log('save it with the form save button')
    await client.click('.setting-tabs-quick-commands button[type="submit"]')
    await delay(1500)

    const qm = await client.evaluate(() => {
      return window.store.quickCommands.find(q => q.name === 'Test Quick Command')
    })
    expect(!!qm).equal(true)
    expect(qm.commands.length).equal(2)
    expect(qm.commands[0].command).equal('ls -al')
    expect(qm.commands[1].command).equal('df -h')
    expect(qm.labels).deep.equal(['test'])

    log('quick command should be listed in the settings panel')
    await client.hasElem('.setting-tabs-quick-commands .item-list-unit')

    log('close app')
    await electronApp.close()
  })
})
