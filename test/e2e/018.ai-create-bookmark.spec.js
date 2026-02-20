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
const path = require('path')

describe('AI Create Bookmark', function () {
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

  it('should configure AI and create bookmark using AI', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(5500)

    log('clear AI config to trigger AI config page')
    await client.evaluate(() => {
      return window.store.setConfig({
        modelAI: ''
      })
    })

    log('open bookmarks page')
    await client.click('.btns .anticon-plus-circle')
    await delay(2500)

    const sel = '.setting-wrap .ant-tabs-nav-list .ant-tabs-tab-active'
    await client.hasElem(sel)
    const text = await client.getText(sel)
    expect(text).equal('Bookmarks')

    log('click AI create bookmark button - should open AI config')
    const aiCreateBtn = client.locator('.create-ai-btn')
    await aiCreateBtn.click()
    await delay(1000)

    log('verify AI config form is shown')
    await client.hasElem('.setting-wrap .ai-config-form')

    log('fill AI configuration form')
    await client.setValue('#baseURLAI', 'http://localhost:43434')
    await client.setValue('#apiPathAI', '/chat/completions')
    await client.setValue('#modelAI', 'gpt-3.5-turbo')
    await client.setValue('#apiKeyAI', 'test-api-key')
    await client.setValue('#roleAI', 'You are a helpful assistant')
    await client.setValue('#languageAI', 'English')

    log('save AI configuration')
    await client.click('.ai-config-form button[type="submit"]')
    await delay(1000)

    log('close setting panel')
    await client.click('.close-setting-wrap-icon')
    await delay(1000)

    log('open bookmarks page again')
    await client.click('.btns .anticon-plus-circle')
    await delay(2500)

    log('click AI create bookmark button again')
    const aiCreateBtn2 = client.locator('.create-ai-btn')
    await aiCreateBtn2.click()
    await delay(1000)

    log('verify AI bookmark form is shown')
    await client.hasElem('.ai-bookmark-form')

    log('enter description for bookmark')
    const testDescription = 'A test SSH server for development'
    await client.setValue('.ai-bookmark-form textarea', testDescription)

    log('click generate button')
    const generateBtn = client.locator('.ai-bookmark-form button:has-text("Submit")')
    await generateBtn.click()
    await delay(1500)

    log('verify modal and JSON preview')
    await client.hasElem('.custom-modal-wrap')

    const jsonPreview = client.locator('.ai-bookmark-json-preview')
    await client.hasElem('.ai-bookmark-json-preview')
    const previewText = await jsonPreview.textContent()
    expect(previewText).toContain('Test Server')
    expect(previewText).toContain('test.example.com')

    log('confirm bookmark creation')
    const confirmBtn = client.locator('.custom-modal-wrap .custom-modal-footer-buttons button:has-text("Confirm")')
    await confirmBtn.click()
    await delay(1000)

    log('verify bookmark was created')
    const bookmarks = await client.evaluate(() => {
      return window.store.bookmarks
    })
    const createdBookmark = bookmarks.find(b =>
      b.title && b.title.includes('Test Server')
    )
    expect(createdBookmark).toBeDefined()
    expect(createdBookmark.host).toEqual('test.example.com')
    expect(createdBookmark.port).toEqual(22)
    expect(createdBookmark.username).toEqual('testuser')

    await delay(500)

    log('verify AI bookmark form is shown')
    await client.hasElem('.ai-bookmark-form')

    log('click cancel button to return to normal form')
    const cancelBtn = client.locator('.ai-bookmark-form .anticon-close').first()
    await cancelBtn.click()
    await delay(1500)

    log('verify returned to normal bookmark edit form')
    await client.hasElem('.form-wrap #ssh-form_host')

    await electronApp.close().catch(console.log)
  })
})
