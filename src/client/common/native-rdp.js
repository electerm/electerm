/**
 * Which RDP client opens a bookmark, and whether opening it must leave a tab.
 *
 * Split out of components/rdp/native-rdp.js (which owns the actual launch and
 * therefore imports the message UI) so this part stays loadable under plain
 * node: the unit test in src/test/unit-ci/native-rdp-mode.spec.js loads it
 * directly. Same reason platform.js was split out of constants.js -- that one
 * imports the logo .png files and window.
 *
 * The platform is read once at import time through platform.js, and every
 * exported decision takes it as an optional last argument so tests can state a
 * platform instead of patching globals.
 */
import { isWin } from './platform.js'

const RDP_TYPE = 'rdp'

/**
 * @returns {{win: boolean, webApp: boolean}} what the running build is
 */
function currentEnv () {
  return {
    win: isWin,
    // in the web app `pre.isWin` describes the machine running the electerm
    // server, not the browser that would have to start mstsc
    webApp: typeof window !== 'undefined' && !!window.et && !!window.et.isWebApp
  }
}

/**
 * @param {{win: boolean, webApp: boolean}} [env]
 * @returns {boolean} can this build start the local RDP client at all
 */
export function canUseNativeRdp (env = currentEnv()) {
  return !!env.win && !env.webApp
}

/**
 * Does this tab ask for the local client and can this build provide one?
 * @param {object} tab
 * @param {{win: boolean, webApp: boolean}} [env]
 * @returns {boolean}
 */
export function isNativeRdpTab (tab, env = currentEnv()) {
  return !!tab &&
    tab.type === RDP_TYPE &&
    !!tab.nativeRdp &&
    canUseNativeRdp(env)
}

/**
 * Should this bookmark skip the placeholder tab and just start the external
 * window? Only when it asks for the local client at all -- everywhere else the
 * built-in client needs its tab. Absent or true keeps the tab, which is what
 * every bookmark written before this option existed expects.
 * @param {object} tab
 * @param {{win: boolean, webApp: boolean}} [env]
 * @returns {boolean}
 */
export function opensWithoutTab (tab, env = currentEnv()) {
  return isNativeRdpTab(tab, env) && tab.nativeRdpTab === false
}

export { RDP_TYPE }
