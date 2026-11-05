/**
 * The one user-facing string about the WebGL -> DOM fallback, used by the
 * toast in mixins/term-theme.js.
 */
const noticeKey = 'webglFallbackNotice'

const englishNotice = 'WebGL renderer disabled after a GPU failure. ' +
  'Terminals use the built-in DOM renderer now; switch the renderer setting ' +
  'to re-enable WebGL.'

/**
 * `window.translate` returns the key itself (capitalised) when the installed
 * locale package has no entry for it, so an English sentence is used instead
 * of showing a raw key. As soon as the locale package ships the key, the
 * translated text takes over with no change here.
 */
export function webglFallbackNoticeText () {
  const translated = window.translate(noticeKey)
  return translated.toLowerCase() === noticeKey.toLowerCase()
    ? englishNotice
    : translated
}
