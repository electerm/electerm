/**
 * Inject Electron-version-specific shims into the packaged tree (work/app).
 *
 * Called from prepare.js right after `src/app` is copied there, i.e. once the
 * tree exists and before electron-builder turns it into an asar. The target
 * Electron version is the one pinned in package.json: the legacy workflows
 * (linux-legacy, linux-arm-legacy, linux-arm, linux-loong64-legacy, mac-10,
 * win7-tar) rewrite `devDependencies.electron` to 22.3.27 before installing, so
 * a version check here is enough and no workflow has to know about this step.
 *
 * Nothing is written back to src/: a normal build keeps the modern code and
 * never sees the shims. Every patch asserts its anchor, so a refactor that
 * breaks the injection fails the build instead of shipping an app that dies at
 * startup (the failure mode patchAppImage() was fixed for).
 *
 * Usage:
 *   node src/build/bin/inject-polyfills.js                 # real target version
 *   ELECTERM_ELECTRON_VERSION=22 node .../inject-polyfills.js   # simulate legacy
 *   node .../inject-polyfills.js --dry-run                 # report only
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '../../..')
const LEGACY_MAJOR = 25

// initWidgetProtocol() in src/app/widgets/protocol.js. Deliberately tiny: the
// modern body is one call, so replacing it is a one-line change and the anchor
// is unambiguous.
const INIT_ANCHOR = `function initWidgetProtocol () {
  protocol.handle(SCHEME, serveWidgetFile)
}`

const INIT_LEGACY = `function initWidgetProtocol () {
  require('./protocol-legacy').initWidgetProtocol(protocol, SCHEME, resolveWidgetRequest)
}`

const POLYFILLS = [
  {
    name: 'widget protocol callback adapter',
    applies: major => major < LEGACY_MAJOR,
    files: [
      [
        'src/build/polyfills/electron-lt25/protocol-legacy.js',
        'work/app/widgets/protocol-legacy.js'
      ]
    ],
    patches: [
      {
        file: 'work/app/widgets/protocol.js',
        from: INIT_ANCHOR,
        to: INIT_LEGACY,
        // The injected line references these, so refuse to patch a file that
        // no longer defines/passes them.
        requires: ['function resolveWidgetRequest (', 'serveWidgetFile']
      }
    ]
  }
]

function electronMajorVersion (root = ROOT) {
  const fromEnv = process.env.ELECTERM_ELECTRON_VERSION
  const raw = fromEnv || readPinnedElectron(root)
  const match = /(\d+)/.exec(String(raw || ''))
  return match ? Number(match[1]) : null
}

function readPinnedElectron (root) {
  let pkg
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  } catch (e) {
    return null
  }
  const deps = { ...(pkg.devDependencies || {}), ...(pkg.dependencies || {}) }
  return deps.electron || null
}

function applyPolyfills ({ root = ROOT, major, dryRun = false, log = console.log } = {}) {
  const target = major === undefined || major === null
    ? electronMajorVersion(root)
    : major
  if (target === null) {
    log('[polyfill] cannot tell the Electron version, nothing injected')
    return []
  }
  const applied = []
  for (const polyfill of POLYFILLS) {
    if (!polyfill.applies(target)) {
      log(`[polyfill] skip ${polyfill.name}: Electron ${target} does not need it`)
      continue
    }
    log(`[polyfill] apply ${polyfill.name} for Electron ${target}`)
    for (const [from, to] of polyfill.files || []) {
      const src = path.join(root, from)
      const dst = path.join(root, to)
      if (!fs.existsSync(src)) {
        throw new Error(`[polyfill] missing ${from}`)
      }
      if (!dryRun) {
        fs.mkdirSync(path.dirname(dst), { recursive: true })
        fs.copyFileSync(src, dst)
      }
      log(`[polyfill]   ${from} -> ${to}`)
    }
    for (const patch of polyfill.patches || []) {
      patchFile({ root, patch, dryRun, log })
    }
    applied.push(polyfill.name)
  }
  return applied
}

function patchFile ({ root, patch, dryRun, log }) {
  const file = path.join(root, patch.file)
  if (!fs.existsSync(file)) {
    throw new Error(`[polyfill] missing ${patch.file}`)
  }
  const code = fs.readFileSync(file, 'utf8')
  // Windows checkouts (actions/checkout on windows runners, core.autocrlf) hand
  // us CRLF. Compare on a normalized copy so the anchors match there too, and
  // write the replacement back in whatever EOL the file already uses.
  const lf = code.replace(/\r\n/g, '\n')
  if (lf.includes(patch.to)) {
    log(`[polyfill]   ${patch.file} already patched`)
    return
  }
  const pattern = blockPattern(patch.from)
  if (!pattern.test(code)) {
    throw new Error(
      `[polyfill] cannot patch ${patch.file}: expected block not found.\n` +
      'The build-time injection is anchored on:\n' +
      patch.from + '\n' +
      'Update INIT_ANCHOR/INIT_LEGACY in src/build/bin/inject-polyfills.js together with protocol.js.'
    )
  }
  for (const needle of patch.requires || []) {
    if (!lf.includes(needle)) {
      throw new Error(
        `[polyfill] ${patch.file} no longer contains "${needle}", which the injected adapter calls`
      )
    }
  }
  if (!dryRun) {
    fs.writeFileSync(
      file,
      code.replace(pattern, matched => patch.to.split('\n').join(
        matched.includes('\r\n') ? '\r\n' : '\n'
      ))
    )
  }
  log(`[polyfill]   patched ${patch.file}`)
}

function escapeRegExp (s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// A multi-line block, matched regardless of LF/CRLF in the target file.
function blockPattern (block) {
  return new RegExp(block.split('\n').map(escapeRegExp).join('\\r?\\n'))
}

function main () {
  const dryRun = process.argv.includes('--dry-run')
  const applied = applyPolyfills({ dryRun })
  if (!applied.length) {
    console.log('[polyfill] nothing to inject')
  }
}

if (require.main === module) {
  main()
}

module.exports = {
  LEGACY_MAJOR,
  INIT_ANCHOR,
  INIT_LEGACY,
  POLYFILLS,
  electronMajorVersion,
  applyPolyfills,
  // prepare.js calls this; keep it exported or the build dies with
  // "require(...).main is not a function".
  main
}
