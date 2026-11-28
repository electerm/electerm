/**
 * Whether the AI feature is disabled globally.
 *
 * Set `window.et.disableAIFeature = true` (the same way `disableUpgradeCheck`
 * is injected into the built index.html `_global` data) to hide every
 * AI-related button / icon / setting menu in the UI.
 */
export const isAIDisabled = () => {
  return !!(window.et && window.et.disableAIFeature)
}

export function getAIConfigsLabel () {
  return `AI ${window.translate('settings')}`
}

export function getAIConfigName (config) {
  return config.nameAI || config.modelAI || config.baseURLAI || config.id || ''
}

export function matchesWidgetAIConfig (config, offer) {
  return Object.keys(offer).every(key => (config[key] || '') === offer[key]) &&
    (config.apiKeyAI || '') === (offer.apiKeyAI || '') &&
    (config.proxyAI || '') === (offer.proxyAI || '')
}
