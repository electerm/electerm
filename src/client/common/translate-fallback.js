/**
 * window.translate shows a missing locale key as the capitalized key, such
 * as "InsertAbove". Use the translation when the key exists, the English
 * text otherwise, until the key is added to @electerm/electerm-locales.
 */

export default function translateOr (key, en) {
  const lang = window.getLang ? window.getLang() : null
  return lang && lang[key] ? window.translate(key) : en
}
