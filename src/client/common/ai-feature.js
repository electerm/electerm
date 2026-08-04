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
