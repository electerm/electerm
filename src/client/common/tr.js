/**
 * translate with an English fallback.
 *
 * `window.translate` falls back to the key itself (capitalised), so a string
 * that is still on its way through the electerm-locales release shows up as
 * "SomeKey" in every language. That is worse than English: it is not a word.
 * This helper keeps the UI readable until the locale package ships the key —
 * once it does, the translation wins and the fallback stops being used, with no
 * code change here.
 *
 * Only use it for keys that are not in the published locale package yet; for
 * everything else `window.translate` is the answer.
 */
export default function tr (key, fallback = key) {
  const str = window.translate(key)
  const capitalised = key.charAt(0).toUpperCase() + key.slice(1)
  return str === key || str === capitalised
    ? fallback
    : str
}
