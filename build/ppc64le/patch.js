#!/usr/bin/env node
/**
 * Apply or revert the ppc64le font workaround in an app directory.
 *
 *   node build/ppc64le/patch.js apply  [appDir]    # default: work/app
 *   node build/ppc64le/patch.js revert [appDir]
 *
 * Why it is not in the source tree: this is a workaround for the IBM ppc64le
 * Electron builds (see README.md), and none of it belongs in electerm itself.
 * The only caller is build/bin/build-linux-ppc64le.sh, which applies it to
 * work/app -- the tree electron-builder packs, filled by build/bin/prepare.js
 * with a byte-for-byte copy of src/app -- so a ppc64le build never touches a
 * tracked file, and nothing has to be reverted. Pass another directory to try
 * it against src/app; `revert` then restores those files exactly.
 *
 * What it does, all of it additive and idempotent:
 *
 *   1. copies lib/font-conf-fix.js and lib/font-check.js into <appDir>/lib/
 *      -- the probe is ppc64le-only as well, so it lives here next to the
 *      wrapper instead of in the electerm source tree
 *   2. appends a block to <appDir>/lib/font-check.js that installs the wrapper
 *      around resolveFontWorkaround -- it runs while that module is still
 *      loading, so the wiring below destructures the wrapped export
 *   3. appends a block to <appDir>/lib/single-instance.js that exports
 *      removeInstanceSocket(), which the restart needs to drop the socket lock
 *   4. Wires lib/font-check.js into lib/create-app.js and
 *      lib/create-window.js. The mainline used to do this itself; the probe
 *      window confused Playwright's firstWindow() in e2e, so the requires
 *      moved out of src/app and are injected here instead, anchored on
 *      declarations so reformatting cannot break them. Verified in the
 *      ppc64le QEMU VM (temp/ppc64le-vm/): without this the shipped
 *      workaround is dead code -- the app runs, but zero-font boxes fall
 *      back to nothing and can SIGTRAP again.
 *
 * All blocks are appended, all insertions are anchored: a change anywhere
 * inside those files cannot break the patch silently. The symbols and anchors
 * the patch relies on are checked though -- better a failed build than a
 * workaround that does nothing. For lib/font-check.js the check runs against
 * the payload that is about to be copied in, so a broken payload is caught
 * before anything is written.
 */

const fs = require('fs')
const { join, resolve } = require('path')

const DEFAULT_APP_DIR = resolve(__dirname, '../../work/app')
const FIX_SOURCE = join(__dirname, 'lib', 'font-conf-fix.js')
const FIX_TARGET = 'lib/font-conf-fix.js'
const FONT_CHECK_SOURCE = join(__dirname, 'lib', 'font-check.js')
const FONT_CHECK_TARGET = 'lib/font-check.js'

// Files the patch owns: copied into the app tree, never patched in place
// unless a BLOCK below targets them.
const EXPORTS = [
  { source: FIX_SOURCE, target: FIX_TARGET },
  { source: FONT_CHECK_SOURCE, target: FONT_CHECK_TARGET }
]

const BEGIN = '// >>> electerm ppc64le font workaround (build/ppc64le/patch.js)'
const END = '// <<< electerm ppc64le font workaround'

const BLOCKS = [
  {
    file: 'lib/font-check.js',
    // Symbols the appended block depends on. Anchored on declarations rather
    // than on surrounding text, so formatting changes do not matter.
    expect: [
      [/function resolveFontWorkaround\s*\(/, 'resolveFontWorkaround()'],
      [/function precheckFonts\s*\(/, 'precheckFonts()'],
      [/module\.exports\s*=\s*\{[\s\S]*?resolveFontWorkaround/, 'the resolveFontWorkaround export'],
      [/module\.exports\s*=\s*\{[\s\S]*?precheckFonts/, 'the precheckFonts export']
    ],
    body: `${BEGIN}
// The renderer resolved no font at all. Restart once with the fontconfig file
// next to app.asar instead of going straight to the bundled web font.
// install() replaces the export below while this module is still loading, so
// the create-app/create-window wiring destructures the wrapped function.
try {
  require('./font-conf-fix').install(module.exports)
} catch (err) {
  console.error('electerm: ppc64le font workaround not installed:', err)
}
${END}
`
  },
  {
    file: 'lib/single-instance.js',
    expect: [
      [/function cleanupSocket\s*\(/, 'cleanupSocket()'],
      [/module\.exports\s*=\s*\{/, 'the module.exports object']
    ],
    body: `${BEGIN}
// font-conf-fix.js drops the socket lock before restarting electerm, otherwise
// the new process can take itself for a second instance and quit.
module.exports.removeInstanceSocket = function () {
  cleanupSocket()
}
${END}
`
  },
  {
    file: 'lib/create-app.js',
    insertions: [
      {
        name: 'the precheckFonts require',
        anchor: /const \{ setupCrashReporter, setupCommandLineSwitches \} = require\('\.\/crash-reporter'\)\r?\n/,
        text: "const { precheckFonts } = require('./font-check')\n"
      },
      {
        name: 'the whenReady precheck call',
        anchor: /app\.whenReady\(\)\.then\(async \(\) => \{\r?\n/,
        text: '    // Linux only, and it overlaps with loading the config rather than\n    // delaying the first window (see font-check.js).\n    precheckFonts()\n'
      }
    ]
  },
  {
    file: 'lib/create-window.js',
    insertions: [
      {
        name: 'the resolveFontWorkaround require',
        anchor: /const webviewHandler = require\('\.\/webview-handler'\)\r?\n/,
        text: "\nconst { resolveFontWorkaround } = require('./font-check')\n"
      },
      {
        name: 'the fontFix call',
        anchor: /const \{ useSystemTitleBar = defaults\.useSystemTitleBar \} = userConfig\r?\n/,
        text: '  // On a box where Chromium resolves no font, Blink aborts the renderer on\n  // the first glyph it needs, so ask the probe and let it fall back to the\n  // bundled web font when even that resolves nothing (see font-check.js).\n  // {} on any normal install.\n  const fontFix = await resolveFontWorkaround()\n'
      },
      {
        name: 'the fontFix spread',
        anchor: /spellcheck: false/,
        text: ',\n      ...fontFix'
      }
    ]
  }
]

function log (msg) {
  console.log(`[ppc64le] ${msg}`)
}

function fail (msg) {
  console.error(`[ppc64le] ERROR: ${msg}`)
  process.exit(1)
}

function assertSources () {
  for (const e of EXPORTS) {
    if (!fs.existsSync(e.source)) {
      fail(`missing ${e.source}`)
    }
  }
}

const providedBy = file => EXPORTS.find(e => e.target === file)

function readTarget (appDir, file) {
  try {
    return fs.readFileSync(join(appDir, file), 'utf8')
  } catch (err) {
    fail(`cannot read ${join(appDir, file)} -- is ${appDir} an app tree?`)
  }
}

// Texts are stored with LF; files in the tree are not (create-app.js is CRLF,
// checked in that way). Rewrite the inserted text in the file's own line
// endings, so both apply and revert stay byte-exact.
function inFileEol (src, text) {
  const eol = src.includes('\r\n') ? '\r\n' : '\n'
  return text.replace(/\n/g, eol)
}

function applyInsertions (appDir, block) {
  let src = readTarget(appDir, block.file)
  let changed = false
  for (const ins of block.insertions) {
    const text = inFileEol(src, ins.text)
    if (src.includes(text)) {
      log(`already applied: ${ins.name} (${block.file})`)
      continue
    }
    // Exactly one anchor match, checked before writing anything.
    const global = new RegExp(ins.anchor.source, ins.anchor.flags + 'g')
    const hits = src.match(global) || []
    if (hits.length !== 1) {
      fail(`${block.file}: anchor for ${ins.name} matches ${hits.length} times; update build/ppc64le/patch.js`)
    }
    const m = ins.anchor.exec(src)
    const at = m.index + m[0].length
    src = src.slice(0, at) + text + src.slice(at)
    changed = true
    log(`inserted: ${ins.name} (${block.file})`)
  }
  if (changed) {
    fs.writeFileSync(join(appDir, block.file), src)
  }
}

function revertInsertions (appDir, block) {
  const file = join(appDir, block.file)
  let src
  try {
    src = fs.readFileSync(file, 'utf8')
  } catch (err) {
    log(`not there, skipped: ${block.file}`)
    return
  }
  let restored = src
  for (const ins of block.insertions) {
    restored = restored.split(inFileEol(src, ins.text)).join('')
  }
  if (restored !== src) {
    fs.writeFileSync(file, restored)
    log(`restored: ${block.file}`)
  } else {
    log(`not applied, skipped: ${block.file}`)
  }
}

function apply (appDir) {
  assertSources()
  // Read and validate everything before writing anything, so a missing file or
  // a renamed symbol can never leave the tree half patched. A block target the
  // patch provides is not in the tree yet, so validate the payload instead --
  // it is what will be copied in.
  for (const block of BLOCKS) {
    const provided = providedBy(block.file)
    const src = provided
      ? fs.readFileSync(provided.source, 'utf8')
      : readTarget(appDir, block.file)
    for (const [re, name] of (block.expect || [])) {
      if (!re.test(src)) {
        fail(`${block.file} has no ${name} any more; update build/ppc64le/patch.js`)
      }
    }
  }
  for (const e of EXPORTS) {
    const target = join(appDir, e.target)
    // Never overwrite a copy that already carries the block: apply is
    // idempotent, and a fresh copy would silently drop the appended wrapper.
    if (providedBy(e.target) && fs.existsSync(target) &&
      fs.readFileSync(target, 'utf8').includes(BEGIN)) {
      log(`already applied: ${e.target}`)
      continue
    }
    fs.copyFileSync(e.source, target)
    log(`copied: ${e.target}`)
  }
  for (const block of BLOCKS) {
    if (block.insertions) {
      applyInsertions(appDir, block)
      continue
    }
    // Read back what is on disk now: a provided target holds the fresh copy,
    // an in-tree one is the file that was just validated.
    const src = readTarget(appDir, block.file)
    if (src.includes(BEGIN)) {
      log(`already applied: ${block.file}`)
      continue
    }
    fs.writeFileSync(join(appDir, block.file), src + '\n' + block.body)
    log(`patched: ${block.file}`)
  }
}

function revert (appDir) {
  for (const block of BLOCKS) {
    if (block.insertions) {
      revertInsertions(appDir, block)
      continue
    }
    const file = join(appDir, block.file)
    let src
    try {
      src = fs.readFileSync(file, 'utf8')
    } catch (err) {
      log(`not there, skipped: ${block.file}`)
      continue
    }
    let i = src.indexOf(BEGIN)
    if (i === -1) {
      log(`not applied, skipped: ${block.file}`)
      continue
    }
    // Cut the newline the apply step added along with the block itself.
    if (i > 0 && src[i - 1] === '\n') {
      i--
    }
    fs.writeFileSync(file, src.slice(0, i))
    log(`restored: ${block.file}`)
  }
  for (const e of EXPORTS) {
    const target = join(appDir, e.target)
    if (fs.existsSync(target)) {
      fs.unlinkSync(target)
      log(`removed: ${e.target}`)
    }
  }
}

function usage () {
  console.error(`usage: node build/ppc64le/patch.js apply|revert [appDir]

  appDir defaults to work/app, which is what build/bin/build-linux-ppc64le.sh
  patches. It is a build artifact: apply there and there is nothing to revert.`)
  process.exit(1)
}

const [, , action, appDirArg] = process.argv
const appDir = appDirArg ? resolve(appDirArg) : DEFAULT_APP_DIR

if (action === 'apply') {
  apply(appDir)
  log(`done -> ${appDir}`)
} else if (action === 'revert') {
  revert(appDir)
  log(`done -> ${appDir}`)
} else {
  usage()
}
