const { _electron: electron } = require('@playwright/test')
const { test: it, expect } = require('@playwright/test')
const { describe } = it
const delay = require('./common/wait')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')
const configureMockAI = require('./common/configure-mock-ai')
const e = require('./common/lang')
const { spawn } = require('child_process')
const path = require('path')
const { mkdtempSync, readdirSync, readFileSync, rmSync } = require('fs')
const { tmpdir } = require('os')

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
    await expect(form.getByText('Enter an API key for OpenAI.')).toBeVisible()

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

  it('exports AI profiles without credentials and reuses matching local credentials on import', async function () {
    // Select the test directory in Electron's native export dialog.
    await electronApp.evaluate(({ dialog }, directory) => {
      const open = dialog.showOpenDialogSync
      dialog.showOpenDialogSync = () => {
        dialog.showOpenDialogSync = open
        return [directory]
      }
    }, dataDir)
    await client.evaluate(async () => {
      const { store } = window
      store.saveAIConfig({
        ...store.newAIConfig(),
        nameAI: 'Work',
        baseURLAI: 'https://work.example.test/v1',
        apiKeyAI: 'export-api-secret',
        proxyAI: 'http://me:export-proxy-secret@proxy.example.test:8080'
      })
      await store.handleExportAllData()
    })
    const filename = readdirSync(dataDir).find(name => name.endsWith('-electerm-all-data.json'))
    expect(filename).toBeTruthy()
    const filePath = path.join(dataDir, filename)
    const content = readFileSync(filePath, 'utf8')
    expect(content).not.toMatch(/export-(?:api|proxy)-secret/)
    expect(JSON.parse(content).aiConfigs[0].nameAI).toBe('Work')

    const result = await client.evaluate(async filePath => {
      const { store } = window
      await store.importAll({ filePath })
      const { id, apiKeyAI, proxyAI } = store.activeAIConfig
      store.deleteAIConfig(id)
      await store.importAll({ filePath })
      const fresh = store.activeAIConfig
      return {
        localKey: apiKeyAI,
        localProxy: proxyAI,
        freshName: fresh.nameAI,
        freshKey: fresh.apiKeyAI,
        freshProxy: fresh.proxyAI
      }
    }, filePath)
    expect(result).toEqual({
      localKey: 'export-api-secret',
      localProxy: 'http://me:export-proxy-secret@proxy.example.test:8080',
      freshName: 'Work',
      freshKey: '',
      freshProxy: 'http://proxy.example.test:8080/'
    })
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
