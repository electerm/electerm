#!/usr/bin/env node
/**
 * Self-test for the ppc64le font workaround.
 *
 *   node build/ppc64le/test.js
 *
 * Stubs electron, child_process and single-instance, so it runs anywhere --
 * no ppc64le box, no Linux, no display, no fonts. It checks the decision logic
 * (when to restart, when to leave things alone), what goes into the log, and
 * that a failed restart can never leave the user without a window.
 */

const assert = require('assert')
const { execFileSync } = require('child_process')
const Module = require('module')
const fs = require('fs')
const os = require('os')
const { join } = require('path')

// ---------------------------------------------------------------- stubs
let exitCalls
let spawnCalls
let socketDrops
let spawnThrows
let socketThrows

const realLoad = Module._load
Module._load = function (request) {
  if (request === 'electron') {
    return {
      app: {
        exit () {
          exitCalls++
        }
      }
    }
  }
  if (request === 'child_process') {
    return {
      spawn (cmd, args, opts) {
        if (spawnThrows) {
          throw new Error('spawn failed on purpose')
        }
        spawnCalls.push({ cmd, args, opts })
        return { unref () {} }
      }
    }
  }
  if (request === './single-instance') {
    if (socketThrows) {
      throw new Error('single-instance is not patched here')
    }
    return {
      removeInstanceSocket () {
        socketDrops++
      }
    }
  }
  return realLoad.apply(this, arguments)
}

// install() does nothing unless it believes it is on Linux.
const setPlatform = value => Object.defineProperty(process, 'platform', {
  value,
  configurable: true
})
setPlatform('linux')

const fix = require(join(__dirname, 'lib', 'font-conf-fix.js'))

// ---------------------------------------------------------------- helpers
const resourcesDir = fs.mkdtempSync(join(os.tmpdir(), 'ppc64le-font-'))
const bundledConf = join(resourcesDir, 'electerm-fonts.conf')
fs.writeFileSync(bundledConf, '<fontconfig/>')

const ZERO_FONTS = {
  defaultFontFamily: { sansSerif: 'Maple Mono' }
}
const FONTS_OK = {}
const WEB_FONT_LINE = 'falling back to the bundled Maple Mono web font'

const notices = []
const realError = console.error
console.error = (...args) => notices.push(args.join(' '))

let originalCalls

function reset () {
  exitCalls = 0
  spawnCalls = []
  socketDrops = 0
  spawnThrows = false
  socketThrows = false
  originalCalls = 0
  notices.length = 0
  process.resourcesPath = resourcesDir
  delete process.env.ELECTERM_FONTCONF
  delete process.env.ELECTERM_FONT_CONF_RESTARTED
  delete process.env.FONTCONFIG_FILE
  delete process.env.ELECTERM_SAFE_FONT
}

/**
 * Stands in for lib/font-check.js: precheckFonts() is the silent cached probe,
 * resolveFontWorkaround() is the one that announces the web font fallback.
 */
function wrap (fontsOk) {
  const fontCheck = {
    precheckFonts: async () => fontsOk,
    resolveFontWorkaround: async () => {
      originalCalls++
      if (fontsOk) {
        return FONTS_OK
      }
      console.error(WEB_FONT_LINE)
      return ZERO_FONTS
    }
  }
  fix.install(fontCheck)
  return fontCheck.resolveFontWorkaround
}

const logged = () => notices.join('\n')

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Run the wrapper and report what its promise did. The restart path returns a
 * promise that never settles, so it can never be awaited directly: with nothing
 * else on the event loop, node would just exit quietly at that await.
 */
async function run (wrapped) {
  const state = { settled: false, value: undefined, error: undefined }
  wrapped().then(
    value => {
      state.settled = true
      state.value = value
    },
    error => {
      state.settled = true
      state.error = error
    }
  )
  await wait(50)
  return state
}

let passed = 0
function ok (name, condition) {
  assert.ok(condition, name)
  passed++
  console.log(`  ok  ${name}`)
}

// ---------------------------------------------------------------- tests
async function main () {
  console.log('ppc64le font workaround')

  reset()
  let state = await run(wrap(true))
  ok('healthy system: no restart', exitCalls === 0 && spawnCalls.length === 0)
  ok('healthy system: empty workaround', state.value && Object.keys(state.value).length === 0)
  ok('healthy system: quiet', notices.length === 0)

  reset()
  state = await run(wrap(false))
  const call = spawnCalls[0]
  ok('zero fonts: restarts once', spawnCalls.length === 1 && exitCalls === 1)
  ok('zero fonts: uses the bundled conf', call.opts.env.FONTCONFIG_FILE === bundledConf)
  ok('zero fonts: marks the restarted process', call.opts.env.ELECTERM_FONT_CONF_RESTARTED === '1')
  ok('zero fonts: drops the socket lock first', socketDrops === 1)
  ok('zero fonts: detached, unref, inherited stdio',
    call.opts.detached === true && call.opts.stdio === 'inherit' && call.opts.env !== process.env)
  ok('zero fonts: relaunches itself', call.cmd === process.execPath && Array.isArray(call.args))
  ok('zero fonts: the result never settles', state.settled === false)
  ok('zero fonts: says what it is doing', logged().includes(`FONTCONFIG_FILE=${bundledConf}`))
  ok('zero fonts: does not claim the web font fallback', !logged().includes(WEB_FONT_LINE))
  ok('zero fonts: never reaches the web font code', originalCalls === 0)

  reset()
  process.env.ELECTERM_FONT_CONF_RESTARTED = '1'
  state = await run(wrap(false))
  ok('already restarted: no second restart', spawnCalls.length === 0 && state.value === ZERO_FONTS)
  ok('already restarted: web font fallback announced', logged().includes(WEB_FONT_LINE))

  reset()
  process.env.FONTCONFIG_FILE = '/tmp/somebody-elses.conf'
  state = await run(wrap(false))
  ok('FONTCONFIG_FILE set by the user: left alone', spawnCalls.length === 0 && state.value === ZERO_FONTS)

  reset()
  process.env.ELECTERM_SAFE_FONT = '1'
  state = await run(wrap(false))
  ok('ELECTERM_SAFE_FONT=1: web font wins', spawnCalls.length === 0 && state.value === ZERO_FONTS)

  reset()
  process.resourcesPath = join(resourcesDir, 'nowhere')
  state = await run(wrap(false))
  ok('no bundled conf: web font fallback', spawnCalls.length === 0 && state.value === ZERO_FONTS)

  reset()
  const ownConf = join(resourcesDir, 'own.conf')
  fs.writeFileSync(ownConf, '<fontconfig/>')
  process.env.ELECTERM_FONTCONF = ownConf
  await run(wrap(false))
  ok('ELECTERM_FONTCONF: beats the bundled one', spawnCalls[0].opts.env.FONTCONFIG_FILE === ownConf)

  reset()
  process.env.ELECTERM_FONTCONF = join(resourcesDir, 'missing.conf')
  state = await run(wrap(false))
  ok('ELECTERM_FONTCONF pointing nowhere: no restart', spawnCalls.length === 0 && state.value === ZERO_FONTS)
  ok('ELECTERM_FONTCONF pointing nowhere: said so', logged().includes('missing file'))

  reset()
  spawnThrows = true
  state = await run(wrap(false))
  ok('spawn fails: web font fallback, app not exited', exitCalls === 0 && state.value === ZERO_FONTS)
  ok('spawn fails: both notices, restart one first',
    logged().indexOf('restarting with the bundled fontconfig') < logged().indexOf(WEB_FONT_LINE))

  reset()
  socketThrows = true
  await run(wrap(false))
  ok('socket cannot be dropped: restart still happens', spawnCalls.length === 1 && exitCalls === 1)

  reset()
  setPlatform('darwin')
  state = await run(wrap(false))
  ok('not Linux: untouched', spawnCalls.length === 0 && state.value === ZERO_FONTS && originalCalls === 1)
  setPlatform('linux')

  reset()
  fix.install({ resolveFontWorkaround: async () => FONTS_OK })
  ok('no precheckFonts to call: complains instead of throwing',
    logged().includes('nothing to wrap'))
  ok('no precheckFonts to call: wrapper not installed', originalCalls === 0)

  // -------------------------------------- patch.js apply/revert round trip
  // The wiring insertions (create-app.js / create-window.js) are what keeps
  // the workaround alive now that the mainline no longer requires it.
  const patchApp = fs.mkdtempSync(join(os.tmpdir(), 'ppc64le-patch-'))
  const libDir = join(patchApp, 'lib')
  fs.mkdirSync(libDir)
  const wired = ['create-app.js', 'create-window.js', 'single-instance.js']
  for (const f of wired) {
    fs.copyFileSync(join(__dirname, '..', '..', 'src', 'app', 'lib', f), join(libDir, f))
  }
  const runPatch = (...args) => execFileSync(
    process.execPath, [join(__dirname, 'patch.js'), ...args], { stdio: 'pipe' })
  runPatch('apply', patchApp)
  const patchedApp = fs.readFileSync(join(libDir, 'create-app.js'), 'utf8')
  ok('apply: create-app requires font-check',
    patchedApp.includes("const { precheckFonts } = require('./font-check')"))
  ok('apply: create-app calls precheckFonts inside whenReady',
    /app\.whenReady\(\)[\s\S]*?precheckFonts\(\)[\s\S]*?getDbConfig/.test(patchedApp))
  const patchedWin = fs.readFileSync(join(libDir, 'create-window.js'), 'utf8')
  ok('apply: create-window awaits resolveFontWorkaround',
    patchedWin.includes('const fontFix = await resolveFontWorkaround()'))
  ok('apply: webPreferences spread fontFix', patchedWin.includes('...fontFix'))
  ok('apply: single-instance exports removeInstanceSocket',
    fs.readFileSync(join(libDir, 'single-instance.js'), 'utf8')
      .includes('removeInstanceSocket'))
  runPatch('apply', patchApp) // must be a no-op the second time
  ok('apply: idempotent', fs.readFileSync(join(libDir, 'create-app.js'), 'utf8') === patchedApp)
  runPatch('revert', patchApp)
  for (const f of wired) {
    const restored = fs.readFileSync(join(libDir, f), 'utf8')
    const pristine = fs.readFileSync(join(__dirname, '..', '..', 'src', 'app', 'lib', f), 'utf8')
    ok(`revert: ${f} byte-exact`, restored === pristine)
  }
  fs.rmSync(patchApp, { recursive: true, force: true })

  fs.rmSync(resourcesDir, { recursive: true, force: true })
  console.error = realError
  Module._load = realLoad

  console.log(`\n${passed} passed`)
}

main().catch(err => {
  console.error = realError
  console.error(err)
  process.exit(1)
})
