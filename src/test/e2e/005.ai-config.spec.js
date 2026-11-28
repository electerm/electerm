const { _electron: electron } = require('@playwright/test')
const { test: it, expect } = require('@playwright/test')
const { describe } = it
const delay = require('./common/wait')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')
const configureMockAI = require('./common/configure-mock-ai')
const startWebdav = require('./common/test-webdav')
const e = require('./common/lang')
const { en_us: english } = require('@electerm/electerm-locales')
const { spawn } = require('child_process')
const path = require('path')
const { mkdtempSync, readdirSync, readFileSync, rmSync } = require('fs')
const { tmpdir } = require('os')

async function answerTransfer (client, action, buttonKey, beforeAnswer) {
  const dialog = client.locator('.unencrypted-transfer-confirm')
  await Promise.all([
    client.evaluate(action),
    (async () => {
      await expect(dialog).toBeVisible()
      if (beforeAnswer) await beforeAnswer(dialog)
      await dialog.getByRole('button', { name: e(buttonKey), exact: true }).click()
    })()
  ])
  await expect(dialog).toBeHidden()
}

async function expectUploadWarning (dialog, title, destination) {
  await expect(dialog.locator('.ant-modal-confirm-title')).toHaveText(title)
  await expect(dialog).toContainText(english.lang.unencryptedSyncDetails, { ignoreCase: true })
  await expect(dialog).toContainText(destination)
  await expect(dialog).not.toContainText(e('exportDataWarn'))
}

describe('AI Config and Suggestions', function () {
  let aiServer
  let electronApp
  let client
  let dataDir

  // Start AI API server before all tests
  it.beforeAll(async () => {
    const serverPath = path.join(__dirname, 'common', 'ai-api.js')
    aiServer = spawn('node', [serverPath])
    await new Promise(resolve => setTimeout(resolve, 1000)) // Wait for server to start
  })

  // Stop AI API server after all tests
  it.afterAll(() => {
    if (aiServer) {
      aiServer.kill()
    }
  })

  it.beforeEach(async () => {
    dataDir = mkdtempSync(path.join(tmpdir(), 'electerm-ai-configs-'))
    const env = { ...appOptions.env, DATA_PATH: dataDir }
    electronApp = await electron.launch({ ...appOptions, env })
    client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(4500)
  })

  it.afterEach(async () => {
    try {
      await electronApp?.close()
    } finally {
      electronApp = undefined
      if (dataDir) rmSync(dataDir, { recursive: true, force: true })
    }
  })

  it('opens the AI settings tab and creates, selects, edits and deletes saved configurations', async function () {
    // Click AI button to open settings
    await client.evaluate(() => {
      return window.store.setConfig({
        showCmdSuggestions: true
      })
    })
    await client.click('.terminal-footer-ai .ai-icon')
    await delay(1000)

    // Verify AI setting page is open
    const panel = client.locator('.setting-tabs-ai-configs')
    const form = panel.locator('.ai-config-form')
    const list = panel.locator('.item-type-aiConfigs')
    await expect(form).toBeVisible()
    await client.fill('#baseURLAI', 'https://api.openai.com/v1')
    await client.fill('#apiKeyAI', '   ')
    await form.getByRole('button', { name: e('save'), exact: true }).click()
    await expect(form.locator('#apiKeyAI_help')).toContainText(e('required'))

    // Fill in the AI configuration form
    await client.fill('#nameAI', 'Local provider')
    await client.fill('#baseURLAI', 'http://localhost:43434')
    await client.fill('#apiPathAI', '/chat/completions')
    await client.fill('#modelAI', 'gpt-3.5-turbo')
    await client.fill('#apiKeyAI', 'test-api-key')
    await client.fill('#roleAI', 'You are a helpful assistant')
    await client.fill('#languageAI', 'English')

    await form.getByRole('button', { name: e('saveAndApply'), exact: true }).click()
    await expect(list.locator('.current')).toHaveText('Local provider')
    await list.getByRole('button', { name: e('new'), exact: true }).click()
    await client.fill('#nameAI', 'Second provider')
    await client.fill('#baseURLAI', 'http://127.0.0.1:43434')
    await client.fill('#modelAI', 'second-model')
    await form.getByRole('button', { name: e('save'), exact: true }).click()
    const second = list.locator('.item-list-unit').filter({ hasText: 'Second provider' })
    await expect(second).toHaveClass(/active/)
    await expect(list.locator('.current')).toHaveText('Local provider')
    await second.hover()
    await second.getByTitle(e('apply')).click()
    await expect(second).toHaveClass(/current/)
    await client.fill('#nameAI', 'Renamed provider')
    // The settings list copies every profile when any one changes.
    // An update to the other profile must leave this draft intact.
    await client.evaluate(() => {
      const { store } = window
      const other = store.aiConfigs.find(item => item.nameAI === 'Local provider')
      store.saveAIConfig({ ...other, nameAI: 'Updated local provider' })
    })
    await expect(list.getByRole('button', { name: 'Updated local provider' })).toBeVisible()
    await expect(form.locator('#nameAI')).toHaveValue('Renamed provider')
    await form.getByRole('button', { name: e('save'), exact: true }).click()
    await expect(list.locator('.current')).toHaveText('Renamed provider')
    // Sync can replace a table row while that same ID is open for editing.
    await client.evaluate(() => {
      const { store } = window
      store.setItems('aiConfigs', store.aiConfigs.map(item =>
        item.id === store.settingItem.id ? { ...item, apiKeyAI: 'rotated-key' } : { ...item }
      ))
    })
    await expect(form.locator('#apiKeyAI')).toHaveValue('rotated-key')
    await list.getByRole('button', { name: 'Updated local provider' }).click()
    await expect(form.locator('#apiKeyAI')).toHaveValue('test-api-key')
    const renamed = list.locator('.current')
    await renamed.hover()
    await renamed.getByTitle(e('del')).click()
    await client.getByRole('button', { name: e('del'), exact: true }).click()
    await expect(list.locator('.current')).toHaveText('Updated local provider')
    expect(await client.evaluate(() => window.localStorage.getItem('ai_config_history'))).toBeNull()
  })

  it('should verify AI functionality after configuration', async function () {
    // Click AI button after configuration
    await client.evaluate(configureMockAI)
    await client.evaluate(() => {
      return window.store.setConfig({
        showCmdSuggestions: true
      })
    })
    await client.click('.terminal-footer-ai .ai-icon')
    await delay(1000)

    // Verify that the AI setting page does not open this time
    await expect(client.locator('.setting-tabs-ai-configs')).not.toBeVisible()

    // Verify that AI functionality is triggered instead
    await expect(client.locator('.ai-chat-container')).toBeVisible()
  })

  it('should test AI suggestions functionality', async function () {
    await client.evaluate(configureMockAI)
    // Open a terminal or ensure we're in a context where we can input commands
    // You might need to add steps here to open a terminal tab if it's not open by default
    // Click AI button after configuration
    await client.evaluate(() => {
      return window.store.setConfig({
        showCmdSuggestions: true
      })
    })
    // Input a command
    const testCommand = 'test'
    await client.keyboard.type(testCommand)
    await delay(100)
    await client.keyboard.press('ArrowRight')
    await delay(100)
    await client.keyboard.press('ArrowRight')
    await delay(500)

    // Get the initial count of suggestions
    const initialSuggestionsCount = await client.locator('.suggestion-item').count()

    // Click the "Get AI suggestions" button
    await client.click('.terminal-suggestions-sticky div:has-text("Get AI suggestions")')
    await delay(2000) // Wait for suggestions to load

    // Get the new count of suggestions
    const newSuggestionsCount = await client.locator('.suggestion-item').count()

    // Verify that the number of suggestions has increased
    expect(newSuggestionsCount).toBeGreaterThan(initialSuggestionsCount)

    // Verify that the new suggestions start with the input command
    const suggestions = await client.locator('.suggestion-item').allTextContents()
    for (const suggestion of suggestions) {
      expect(suggestion.startsWith(testCommand)).toBeTruthy()
    }
  })

  it('cancels a plaintext backup or exports and restores complete credentials after confirmation', async function () {
    const expected = await client.evaluate(() => {
      const { store } = window
      store.setConfig({ syncSetting: { autoSync: true, autoSyncInterval: 15, autoSyncDirection: 'download' } })
      const bookmarks = [{
        id: 'backup-bookmark',
        type: 'ssh',
        title: 'Build',
        host: 'build.example.test',
        password: 'backup-password',
        privateKey: 'fixture-private-key',
        proxy: ''
      }]
      const profiles = [{ id: 'backup-profile', name: 'Deploy', ssh: { username: 'deploy', password: 'profile-password' } }]
      store.setItems('bookmarks', bookmarks)
      store.setItems('profiles', profiles)
      const work = store.saveAIConfig({
        ...store.newAIConfig(),
        nameAI: 'Work',
        apiKeyAI: 'export-api-secret',
        proxyAI: 'http://me:export-proxy-secret@proxy.example.test:8080'
      })
      const home = store.saveAIConfig({ ...store.newAIConfig(), nameAI: 'Home', apiKeyAI: 'second-key' })
      store.applyAIConfig(home.id)
      return { bookmarks, profiles, aiConfigs: [work, home], config: { activeAIConfigId: home.id } }
    })
    const startExport = () => window.store.handleExportAllData()
    const backupFiles = () => readdirSync(dataDir).filter(name => name.endsWith('-electerm-all-data.json'))

    // Redirect the native directory picker for both attempts. Cancelling
    // before the picker must leave the directory untouched.
    await electronApp.evaluate(({ dialog }, directory) => {
      dialog.showOpenDialogSync = () => [directory]
    }, dataDir)
    await answerTransfer(client, startExport, 'cancel')
    expect(backupFiles()).toEqual([])
    await answerTransfer(client, startExport, 'export', async dialog => {
      await expect(dialog.locator('.ant-modal-confirm-title')).toHaveText(e('export'))
      await expect(dialog).toContainText(e('exportDataWarn'))
      await expect(dialog).not.toContainText(e('unencryptedSyncDetails'))
    })
    expect(backupFiles()).toHaveLength(1)
    const filePath = path.join(dataDir, backupFiles()[0])
    expect(JSON.parse(readFileSync(filePath, 'utf8'))).toMatchObject(expected)

    const restore = async filePath => {
      const { store } = window
      for (const name of ['bookmarks', 'profiles', 'aiConfigs']) store.setItems(name, [])
      store.setConfig({ activeAIConfigId: '', syncSetting: { autoSync: false, autoSyncInterval: 0, autoSyncDirection: 'upload' } })
      await store.importAll({ filePath })
      return {
        bookmarks: store.bookmarks,
        profiles: store.profiles,
        aiConfigs: store.aiConfigs,
        config: { activeAIConfigId: store.activeAIConfig.id, syncSetting: store.config.syncSetting }
      }
    }
    const enableWarning = client.locator('.unencrypted-transfer-confirm').filter({ hasText: english.lang.unencryptedSyncDetails })
    const [restored] = await Promise.all([
      client.evaluate(restore, filePath),
      enableWarning.getByRole('button', { name: e('cancel'), exact: true }).click()
    ])
    await expect(enableWarning).toBeHidden()
    expect(restored).toMatchObject(expected)
    expect(restored.config.syncSetting).toMatchObject({ autoSync: false, autoSyncInterval: 15, autoSyncDirection: 'download' })
  })

  it('confirms manual plaintext WebDAV writes and restores encrypted uploads', async function () {
    it.setTimeout(60000)
    const webdav = await startWebdav()
    const manual = () => window.store.uploadSetting('webdav')
    try {
      const account = await client.evaluate(webdavServerUrl => {
        const { store } = window
        const light = store.getTerminalThemes().find(theme => theme.id === 'defaultLight')
        store.addTheme({ ...light, id: 'sync-dialog-theme', uiThemeConfig: { ...light.uiThemeConfig, main: '#c3c3c3' } })
        store.setTheme('sync-dialog-theme')
        store.setConfig({ dataSyncSelected: 'aiConfigs', syncSetting: { webdavServerUrl } })
        store.setItems('bookmarks', [{ id: 'sync-bookmark', type: 'ssh', title: 'CI', password: 'fixture-password' }])
        return store.saveAIConfig({
          ...store.newAIConfig(),
          nameAI: 'Work',
          apiKeyAI: 'fixture-api-key',
          proxyAI: 'socks5://me:fixture-proxy-password@proxy.example.test'
        })
      }, webdav.url)

      await answerTransfer(client, manual, 'cancel', async dialog => {
        // Check the painted surface both at creation and after the app theme
        // changes while this same confirmation is waiting for an answer.
        const surface = dialog.locator('.ant-modal-container')
        await expect(surface).toHaveCSS('background-color', 'rgb(195, 195, 195)')
        await client.evaluate(() => window.store.setTheme('defaultLight'))
        await expect(surface).toHaveCSS('background-color', 'rgb(237, 237, 237)')
      })
      expect(webdav.requests).toHaveLength(0)
      await answerTransfer(client, manual, 'upload', dialog =>
        expectUploadWarning(dialog, e('uploadSettings'), webdav.url)
      )
      expect(JSON.parse(webdav.files.get('/electerm/aiConfigs.json'))).toEqual([account])
      expect(webdav.files.has('/electerm/bookmarks.json')).toBe(false)
      const requestsAfterUpload = webdav.requests.length
      await answerTransfer(client, manual, 'cancel')
      expect(webdav.requests).toHaveLength(requestsAfterUpload)
      await answerTransfer(client, manual, 'upload', () =>
        client.evaluate(() => window.store.setConfig({ dataSyncSelected: 'aiConfigs,bookmarks' }))
      )
      expect(webdav.requests).toHaveLength(requestsAfterUpload)
      await client.evaluate(() => {
        window.store.setConfig({ dataSyncSelected: 'aiConfigs' })
        window.store.updateSyncSetting({ webdavSyncPassword: 'fixture-sync-password' })
      })
      await client.evaluate(manual)
      const wire = webdav.files.get('/electerm/aiConfigs.json')
      expect(wire).toMatch(/^"?gcm:/)
      expect(wire).not.toContain(account.apiKeyAI)
      expect(wire).not.toContain('fixture-proxy-password')
      const downloaded = await client.evaluate(async () => {
        window.store.saveAIConfig({ ...window.store.aiConfigs[0], apiKeyAI: 'stale-local-key' })
        await window.store.downloadSetting('webdav')
        return window.store.aiConfigs
      })
      expect(downloaded).toEqual([account])
    } finally {
      await webdav.close()
    }
  })

  it('warns once when enabling automatic sync and uploads in the background across reloads', async function () {
    it.setTimeout(60000)
    const webdav = await startWebdav()
    const autoSync = client.locator('.sync-data-transport').getByRole('switch')
    const dialog = client.locator('.unencrypted-transfer-confirm')
    const automatic = () => window.store.uploadSettingAll()
    const countUploads = () => webdav.requests.filter(req => req.method === 'MKCOL').length
    try {
      await client.waitForFunction(() => window.store.autoSyncReady)
      await client.evaluate(() => {
        window.store.setConfig({ dataSyncSelected: 'bookmarks' })
        window.store.openSettingSync()
      })
      await autoSync.click()
      await expect(dialog.locator('.ant-modal-confirm-title')).toHaveText(e('autoSync'))
      await expect(dialog).toContainText(english.lang.unencryptedSyncDetails, { ignoreCase: true })
      await expect(autoSync).not.toBeChecked()
      await dialog.getByRole('button', { name: e('cancel'), exact: true }).click()
      await expect(dialog).toBeHidden()
      await expect(autoSync).not.toBeChecked()

      await autoSync.click()
      await dialog.getByRole('button', { name: e('ok'), exact: true }).click()
      await expect(autoSync).toBeChecked()
      await expect(dialog).toBeHidden()
      await client.evaluate(webdavServerUrl => {
        window.store.updateSyncSetting({ webdavServerUrl })
        window.store.setItems('bookmarks', [{ id: 'sync-bookmark', type: 'ssh', title: 'CI', password: 'fixture-password' }])
      }, webdav.url)
      // Editing a bookmark triggers the change watcher without a dialog.
      await expect.poll(() => webdav.files.has('/electerm/bookmarks.json')).toBe(true)
      expect(JSON.parse(webdav.files.get('/electerm/bookmarks.json'))[0].password).toBe('fixture-password')
      await client.waitForFunction(() => !window.onSyncAll)
      await answerTransfer(client, () => window.store.uploadSetting('webdav'), 'cancel')
      expect(countUploads()).toBe(1)

      await client.evaluate(url => {
        window.store.updateSyncSetting({ webdavServerUrl: url, autoSyncInterval: 5 })
        window.store.setConfig({ dataSyncSelected: 'aiConfigs,bookmarks' })
      }, webdav.url + '/other')
      await client.evaluate(automatic)
      expect(webdav.files.has('/other/electerm/aiConfigs.json')).toBe(true)
      await expect.poll(() => client.evaluate(async () => {
        const saved = await window.pre.runGlobalAsync('dbAction', 'data', 'findOne', { _id: 'userConfig' })
        return saved?.syncSetting?.autoSync && saved.syncSetting.autoSyncInterval === 5 &&
          saved.syncSetting.webdavServerUrl.endsWith('/other')
      })).toBe(true)
      const uploadsBeforeReload = countUploads()
      await client.reload()
      // The interval scheduler checks for its first upload on a ten-second tick.
      await expect.poll(countUploads, { timeout: 25000 }).toBeGreaterThan(uploadsBeforeReload)
      await client.waitForFunction(() => window.store?.autoSyncReady && !window.onSyncAll)
      await expect(dialog).toBeHidden()

      await client.evaluate(() => window.store.openSettingSync())
      await expect(autoSync).toBeChecked()
      await autoSync.click()
      await expect(autoSync).not.toBeChecked()
      await client.evaluate(() => window.store.updateSyncSetting({ autoSyncDirection: 'download', webdavSyncPassword: 'fixture-sync-password' }))
      await autoSync.click()
      await expect(dialog).toContainText(english.lang.unencryptedSyncDetails, { ignoreCase: true })
      await dialog.getByRole('button', { name: e('cancel'), exact: true }).click()
      await expect(autoSync).not.toBeChecked()
    } finally {
      await webdav.close()
    }
  })

  it('imports a credential-free legacy backup without duplicating local accounts', async function () {
    const result = await client.evaluate(async () => {
      const { store } = window
      const legacy = { baseURLAI: 'https://provider.example.test/v1', modelAI: 'shared-model' }
      const first = store.saveAIConfig({ ...legacy, nameAI: 'First', apiKeyAI: 'first-key' })
      const second = store.saveAIConfig({ ...legacy, nameAI: 'Second', apiKeyAI: 'second-key' })
      const other = store.saveAIConfig({ ...store.newAIConfig(), nameAI: 'Other' })
      const backup = { fileContent: JSON.stringify({ config: legacy }) }
      store.applyAIConfig(other.id)
      await store.importAll(backup)
      const fromList = store.activeAIConfig.id
      store.applyAIConfig(second.id)
      await store.importAll(backup)
      return {
        pickedFirst: fromList === first.id,
        keptActive: store.activeAIConfig.id === second.id,
        keys: store.aiConfigs.map(conf => conf.apiKeyAI)
      }
    })
    expect(result).toEqual({ pickedFirst: true, keptActive: true, keys: ['first-key', 'second-key', ''] })
  })

  it('migrates the current provider and its saved history once across reloads', async function () {
    await client.evaluate(async () => {
      const current = {
        ...window.store.newAIConfig(),
        nameAI: 'Work',
        baseURLAI: 'https://work.example.test/v1',
        apiKeyAI: 'legacy-work-key'
      }
      const other = {
        ...current,
        nameAI: 'Home',
        baseURLAI: 'https://home.example.test/v1',
        apiKeyAI: 'legacy-home-key'
      }
      window.localStorage.setItem('ai_config_history', JSON.stringify([other, current]))
      await window.pre.runGlobalAsync('dbAction', 'aiChatHistory', 'insert', {
        _id: 'old-turn', ...current, prompt: 'Hello', response: 'Hi'
      })
      await window.pre.runGlobalAsync('saveUserConfig', current)
    })
    const checkUpgrade = async () => {
      await client.reload()
      await client.waitForFunction(() => window.store?.configLoaded)
      return client.evaluate(async () => {
        const { store, pre } = window
        const saved = await pre.runGlobalAsync('dbAction', 'data', 'findOne', { _id: 'userConfig' })
        const turn = await pre.runGlobalAsync('dbAction', 'aiChatHistory', 'findOne', { _id: 'old-turn' })
        return {
          names: store.aiConfigs.map(c => c.nameAI).sort(),
          active: store.activeAIConfig?.nameAI,
          workKey: store.activeAIConfig?.apiKeyAI,
          homeKey: store.aiConfigs.find(c => c.nameAI === 'Home')?.apiKeyAI,
          storedId: saved.activeAIConfigId,
          selectedId: store.activeAIConfig?.id,
          hasLegacyFields: 'apiKeyAI' in saved || 'baseURLAI' in saved || 'apiKeyAI' in turn || 'proxyAI' in turn,
          turnConfigId: turn.aiConfigId,
          history: window.localStorage.getItem('ai_config_history')
        }
      })
    }
    const first = await checkUpgrade()
    expect(first.names).toEqual(['Home', 'Work'])
    expect(first.active).toBe('Work')
    expect(first.workKey).toBe('legacy-work-key')
    expect(first.homeKey).toBe('legacy-home-key')
    expect(first.storedId).toBeTruthy()
    expect(first.storedId).toBe(first.selectedId)
    expect(first.turnConfigId).toBe(first.selectedId)
    expect(first.hasLegacyFields).toBe(false)
    expect(first.history).toBeNull()
    expect(await checkUpgrade()).toEqual(first)
  })
})
