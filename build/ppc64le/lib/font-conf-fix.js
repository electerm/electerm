/**
 * ppc64le fontconfig workaround -- build-time payload, NOT part of src/app.
 *
 * build/ppc64le/patch.js copies this file into a built app tree as
 * lib/font-conf-fix.js and appends one call to lib/font-check.js; the only
 * caller is build/bin/build-linux-ppc64le.sh. Nothing in the normal source tree
 * (or in any other platform's build) ever loads it. See README.md.
 *
 * Why it exists: on the IBM ppc64le Electron builds the renderer could resolve
 * no font at all, and Chromium then aborts while *reporting* that:
 *
 *   ERROR:ui/gfx/platform_font_skia.cc:258] Could not find any font: Sans, sans.
 *   ERROR:.../remote_font_face_source.cc:365] NOTREACHED hit.
 *   FATAL:third_party/skia/src/ports/SkFontMgr_FontConfigInterface.cpp:163] Not implemented.
 *   Render process gone: crashed { reason: 'crashed', exitCode: 133 }
 *
 * Read that bottom up. The NOTREACHED is FontCache::GetLastResortFallbackFont()
 * returning nullptr, so there is not even a last resort font: zero candidates.
 * Chromium treats that as unrecoverable and calls FontCache::CrashWithFontInfo()
 * to report it, but that helper starts with SkFontMgr::countFamilies(), which
 * Skia's FontConfigInterface manager does not implement -- line 163 is
 * SkFontMgr_FCI::onCountFamilies() { SK_ABORT("Not implemented.") }. The
 * diagnostic therefore aborts before it prints anything useful and the renderer
 * dies with SIGTRAP (128 + 5 == 133): the FATAL is the symptom, "zero candidate
 * fonts" is the cause.
 *
 * fontconfig is healthy in a shell on those boxes (fc-list lists thousands of
 * fonts, fc-match sans resolves to a real file), because Electron links a
 * fontconfig of its own and that copy sees nothing. Feeding it the configuration
 * next to app.asar -- same fonts, but an explicit <dir> list and a private
 * <cachedir> -- fixes it; that is what closed discussion #4529.
 *
 * The variable is read while the first renderer process (or the zygote it is
 * forked from) comes up, so setting it from inside the running app is too late
 * -- measured, not assumed. Hence the one restart.
 */

const fs = require('fs')
const { join } = require('path')
const { spawn } = require('child_process')
const { app } = require('electron')

// Copied next to app.asar by build/bin/build-linux-ppc64le.sh.
const FONT_CONF_FILE = 'electerm-fonts.conf'

// Set on the process we restart, so that a box where even our own configuration
// resolves no font goes to the web font instead of restarting for ever.
const RESTARTED_VAR = 'ELECTERM_FONT_CONF_RESTARTED'

// Point this at a file of your own to use it instead of the bundled one.
const FONT_CONF_VAR = 'ELECTERM_FONTCONF'

function fontConfFile () {
  const configured = process.env[FONT_CONF_VAR]
  if (configured) {
    // An explicit setting that points nowhere is a user error, not a reason to
    // silently use something else.
    if (fs.existsSync(configured)) {
      return configured
    }
    console.error(`electerm: ${FONT_CONF_VAR} points at a missing file: ${configured}`)
    return null
  }
  const bundled = join(process.resourcesPath || '', FONT_CONF_FILE)
  return fs.existsSync(bundled) ? bundled : null
}

/**
 * Drop the socket lock before the restart. The process we are about to start
 * would otherwise still see the socket of the instance on its way out, take
 * itself for a second instance and quit -- leaving the user with no window at
 * all, which is worse than the problem we are fixing. patch.js appends this
 * export to lib/single-instance.js.
 */
function removeStaleInstanceSocket () {
  try {
    const { removeInstanceSocket } = require('./single-instance')
    if (typeof removeInstanceSocket === 'function') {
      removeInstanceSocket()
    }
  } catch (err) {
    console.error('electerm: could not drop the instance socket:', err.message)
  }
}

/**
 * app.relaunch() cannot do this -- its options are args/execPath only -- and
 * handing the variable to a child process is the only way to have it in the
 * environment fontconfig reads while the new renderers (or the zygote they are
 * forked from) come up.
 *
 * stdio is inherited on purpose: the restarted process is the one that has to
 * explain itself on a box that is already misbehaving, and its output would
 * otherwise be lost.
 */
function restartWithFontConf (conf) {
  removeStaleInstanceSocket()
  try {
    spawn(process.execPath, process.argv.slice(1), {
      detached: true,
      stdio: 'inherit',
      env: {
        ...process.env,
        FONTCONFIG_FILE: conf,
        [RESTARTED_VAR]: '1'
      }
    }).unref()
    return true
  } catch (err) {
    console.error('electerm: could not restart with a fontconfig file:', err.message)
    return false
  }
}

const fontConfNotice = conf => `
================================================================================
Chromium cannot see any system font -- restarting with the bundled fontconfig
================================================================================
Blink resolved no font at all, and the first glyph electerm needs would abort
the renderer (SkFontMgr_FontConfigInterface: "Not implemented", exit code 133).

fontconfig may well be fine in a shell (fc-list | wc -l, fc-match sans),
because Electron links a fontconfig of its own, and on some systems that copy
ends up with zero families. electerm is starting again once with an explicit
font list:

  FONTCONFIG_FILE=${conf}

Same fonts, but an explicit <dir> list and a private <cachedir>, so neither the
system fonts.conf nor a stale cache file can hide them. Nothing else changes,
this happens at most once, and an FONTCONFIG_FILE you set yourself always wins.

ELECTERM_FONTCONF=/path/to/file uses your file instead of the bundled one.
================================================================================
`

/**
 * Wrap the font probe so that "renderer sees no font" restarts the app once
 * with electerm-fonts.conf instead of going straight to the web font.
 *
 * Called at the end of lib/font-check.js, which owns the probe. The wrapper is
 * in place before create-window.js and create-app.js destructure the exports,
 * so they get the wrapped function.
 *
 * It asks precheckFonts() -- the same cached probe, and one that prints nothing
 * -- rather than calling resolveFontWorkaround() first and reacting to its
 * answer: that one announces the web font fallback as it returns, which would
 * put "falling back to the bundled Maple Mono web font" in the log just before
 * "restarting with the bundled fontconfig".
 */
function install (fontCheck) {
  if (process.platform !== 'linux') {
    return
  }
  if (
    !fontCheck ||
    typeof fontCheck.resolveFontWorkaround !== 'function' ||
    typeof fontCheck.precheckFonts !== 'function'
  ) {
    console.error('electerm: font-conf-fix: nothing to wrap, workaround disabled')
    return
  }
  const original = fontCheck.resolveFontWorkaround
  fontCheck.resolveFontWorkaround = async function () {
    // ELECTERM_SAFE_FONT is an explicit request for the web font, honour it.
    if (process.env.ELECTERM_SAFE_FONT === '1') {
      return original()
    }
    // true means "fonts are fine" or "cannot tell"; precheckFonts never
    // rejects, and re-running it here costs nothing (font-check caches it).
    if (await fontCheck.precheckFonts()) {
      return original()
    }
    const conf = fontConfFile()
    if (!conf || process.env[RESTARTED_VAR] || process.env.FONTCONFIG_FILE) {
      // Nothing left to try: let font-check.js explain the web font fallback.
      return original()
    }
    console.error(fontConfNotice(conf))
    if (restartWithFontConf(conf)) {
      app.exit(0)
      // Never settle: the caller awaits this and must not go on to create a
      // window in a process that is exiting.
      return new Promise(() => {})
    }
    // The restart did not work, so the web font is the last resort after all.
    return original()
  }
}

module.exports = {
  install
}
