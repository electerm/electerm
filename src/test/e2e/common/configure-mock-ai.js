// Passed to Playwright's page.evaluate so each spec can exercise the local
// test server with its own saved config, independently of other specs.
module.exports = function configureMockAI (overrides = {}) {
  const { store } = window
  const config = store.saveAIConfig({
    ...store.newAIConfig(),
    id: 'e2e-chat-provider',
    nameAI: 'Mock chat provider',
    baseURLAI: 'http://127.0.0.1:43434',
    apiPathAI: '/chat/completions',
    apiKeyAI: 'test-api-key',
    modelAI: 'gpt-3.5-turbo',
    ...overrides
  })
  store.applyAIConfig(config.id)
  return config.id
}
