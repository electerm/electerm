/**
 * Work around Linux boxes where Chromium sees no font at all -- without
 * guessing which one it is, by measuring it.
 *
 * Background (linux ppc64le build, but it can happen anywhere): fontconfig is
 * perfectly healthy -- `fc-list | wc -l` lists thousands of fonts and
 * `fc-match sans` resolves to a real file -- yet Blink resolves nothing:
 *
 *   ERROR:ui/gfx/platform_font_skia.cc:258] Could not find any font: ..., sans.
 *   ERROR:.../remote_font_face_source.cc:365] NOTREACHED hit.
 *   ERROR:third_party/skia/src/ports/SkFontMgr_FontConfigInterface.cpp:163] Not implemented.
 *   Render process gone: crashed { reason: 'crashed', exitCode: 133 }
 *
 * The NOTREACHED is `FontCache::GetLastResortFallbackFont()` returning nullptr
 * (there is no last resort font at all) and the FATAL is
 * `SkFontMgr_FCI::onMatchFamilyStyleCharacter()`, which Skia does not
 * implement: as soon as Blink has to fall back for a single missing glyph the
 * renderer aborts with SIGTRAP (128 + 5 == 133).
 *
 * Nothing here can patch Skia, so this probes what Chromium actually sees and
 * picks the first workaround that works:
 *
 *   1. renderer can see the system fonts  -> nothing to do
 *   2. it cannot                          -> use the bundled Maple Mono web font
 *      (web fonts are built straight from the font data, so they need neither
 *      fontconfig nor any system font)
 *
 * The measurement is verified, so a healthy machine never changes behaviour.
 *
 * Only ever ONE throwaway window is used, and it is closed gently: creating
 * several of them, or destroying one while it is still coming up, makes the
 * whole app die with SIGTRAP on the very machines this is here to help.
 */

const { BrowserWindow } = require('electron')

// Long enough for a cold window + swiftshader, short enough that a wedged
// probe cannot hold up the start up.
const PROBE_TIMEOUT = 4000

// With no font at all Chromium measures a zero width for this string.
const PROBE_JS = `(() => {
  const c = document.createElement('canvas').getContext('2d')
  c.font = '16px sans-serif'
  return c.measureText('mmmmmmmmmmlli').width > 0
})()`

// electerm ships @fontsource/maple-mono inside app.asar, so this one is
// always available, whatever the state of the system fonts.
const FALLBACK_FONT = 'Maple Mono'

async function probeOnce () {
  let win
  try {
    win = new BrowserWindow({
      show: false,
      skipTaskbar: true,
      width: 10,
      height: 10,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false
      }
    })
    await win.loadURL('about:blank')
    const ok = await win.webContents.executeJavaScript(PROBE_JS)
    return !!ok
  } catch (err) {
    return false
  } finally {
    if (win && !win.isDestroyed()) {
      // Close it on the next tick instead of tearing it down mid start up --
      // destroying a window that is still coming up aborts the whole app here.
      setImmediate(() => {
        if (!win.isDestroyed()) {
          win.close()
        }
      })
    }
  }
}

function probe () {
  return Promise.race([
    probeOnce(),
    new Promise(resolve => {
      // A probe that never answers means "cannot tell", not "no fonts".
      setTimeout(() => resolve(true), PROBE_TIMEOUT)
    })
  ])
}

const safeFontFamily = () => ({
  standard: FALLBACK_FONT,
  fixed: FALLBACK_FONT,
  serif: FALLBACK_FONT,
  sansSerif: FALLBACK_FONT,
  monospace: FALLBACK_FONT,
  cursive: FALLBACK_FONT,
  fantasy: FALLBACK_FONT
})

const NO_SYSTEM_FONT_NOTICE = `
================================================================================
⚠️  Chromium cannot see any system font -- falling back to the bundled ${FALLBACK_FONT} web font
================================================================================
fontconfig may well be fine in a shell, but Blink resolves no font here, and
the first glyph it cannot find would abort the renderer
(SkFontMgr_FontConfigInterface: "Not implemented", exit code 133).
Every generic family is now mapped to ${FALLBACK_FONT}, which ships inside the
app, so nothing depends on the system fonts. Coverage is limited to what the
bundled font contains, so install real fonts to get everything:

  sudo apt-get install -y fontconfig fonts-dejavu-core
  sudo fc-cache -fv

ELECTERM_SAFE_FONT=1 forces this mode on a machine that does have fonts.
================================================================================
`

let firstProbe

/**
 * Start the first measurement early so it overlaps with loading the config
 * instead of delaying the first window. Safe to call more than once.
 */
function precheckFonts () {
  if (!firstProbe) {
    firstProbe = probe()
  }
  return firstProbe
}

let workaround

/**
 * Extra webPreferences needed to get any text on screen, or {} when the
 * system is fine. Cached -- it must only run once per start up.
 */
async function resolveFontWorkaround () {
  if (workaround) {
    return workaround
  }
  if (process.platform !== 'linux') {
    workaround = {}
    return workaround
  }
  if (process.env.ELECTERM_SAFE_FONT === '1') {
    workaround = { defaultFontFamily: safeFontFamily() }
    return workaround
  }
  if (await precheckFonts()) {
    workaround = {}
    return workaround
  }
  console.error(NO_SYSTEM_FONT_NOTICE)
  workaround = { defaultFontFamily: safeFontFamily() }
  return workaround
}

module.exports = {
  resolveFontWorkaround,
  precheckFonts,
  safeFontFamily,
  FALLBACK_FONT
}
