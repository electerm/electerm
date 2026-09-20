/**
 * How the terminal area's background relates to the UI main colour.
 *
 * A theme carries two background colours: `main` (uiThemeConfig, the whole UI)
 * and `terminal:background` (themeConfig.background, the terminal area only).
 * They are allowed to differ — that is the whole point of having both — but
 * they are *linked* while they still agree: editing `main` then carries over to
 * `terminal:background`, so the common case stays consistent without the user
 * having to edit two keys.
 *
 * Once the two differ (the theme was authored/imported that way, or the user
 * set a terminal background on purpose) the value is kept as-is and the theme
 * editor warns about the mismatch instead of silently rewriting the user's
 * choice. Kept pure and dependency-free so the rules can be unit tested.
 */

/** theme text key of the terminal area background, `terminal:background` */
export const terminalBgKey = 'background'
/** theme text key of the UI background */
export const mainKey = 'main'

/**
 * CSS custom property carrying the terminal background to `.term-wrap` /
 * `.terms-box` (see components/main/ui-theme.jsx and terminal.styl).
 */
export const terminalBgVar = '--main-terminal'

/**
 * Whether editing `main` should carry over to `terminal:background`.
 * Pass the values *before* the edit — the link only holds while they agree.
 * @param {object} params
 * @param {string} params.main current uiThemeConfig.main
 * @param {string} params.terminalBackground current themeConfig.background
 * @return {boolean}
 */
export function terminalBgFollowsMain ({ main, terminalBackground }) {
  return !!main && !!terminalBackground && terminalBackground === main
}

/**
 * Whether the theme ends up with a terminal background that differs from the UI
 * main colour — allowed, but worth warning about.
 * @param {object} params
 * @param {string} params.main uiThemeConfig.main
 * @param {string} params.terminalBackground themeConfig.background
 * @return {boolean}
 */
export function terminalBgDiffersFromMain ({ main, terminalBackground }) {
  return !!main && !!terminalBackground && terminalBackground !== main
}
