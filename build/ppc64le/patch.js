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
 *   1. copies lib/font-conf-fix.js into <appDir>/lib/, and lib/font-check.js
 *      too -- the probe is ppc64le-only as well, so it lives here next to the
 *      wrapper instead of in the electerm source tree
 *   2. appends a block to <appDir>/lib/font-check.js that installs the wrapper
 *      around resolveFontWorkaround -- it runs while that module is still
 *      loading, so create-window.js and create-app.js destructure the wrapped
 *      export
 *   3. appends a block to <appDir>/lib/single-instance.js that exports
 *      removeInstanceSocket(), which the restart needs to drop the socket lock
 *
 * Both blocks are appended past the end of the existing file, so a change
 * anywhere inside those files cannot break the patch. The symbols the blocks
 * rely on are checked though: better a failed build than a workaround that
 * silently does nothing. For lib/font-check.js the check runs against the
 * payload that is about to be copied in, so a broken payload is caught before
 * anything is written.
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
// create-window.js and create-app.js destructure the wrapped function.
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
    for (const [re, name] of block.expect) {
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
