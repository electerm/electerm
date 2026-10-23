/**
 * electerm-widget:// in both shapes it ships in:
 *
 * - src/app/widgets/protocol.js — the Electron >= 25 implementation, which is
 *   the only one in the sources;
 * - src/build/polyfills/electron-lt25/protocol-legacy.js — copied into the
 *   packaging tree by src/build/bin/inject-polyfills.js when the target
 *   Electron is older than 25.
 *
 * The last suite builds a packaging tree and runs the injection, then loads the
 * patched app, because that wiring — not the adapter on its own — is what a
 * legacy build actually runs.
 */

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const REPO = path.resolve(__dirname, '../../..')
const electronPath = require.resolve('electron')
const protocolPath = require.resolve('../../app/widgets/protocol')
const legacyPath = require.resolve('../../build/polyfills/electron-lt25/protocol-legacy')
const {
  applyPolyfills,
  electronMajorVersion,
  main: injectPolyfillsEntry
} = require('../../build/bin/inject-polyfills')

let tmp
let tmpData
let proto

function stubElectron (protocolImpl = {}, netImpl) {
  require.cache[electronPath] = {
    id: electronPath,
    filename: electronPath,
    loaded: true,
    exports: {
      protocol: protocolImpl,
      net: netImpl || { fetch: () => Promise.reject(new Error('net.fetch not stubbed')) }
    }
  }
}

function loadProtocol (protocolImpl = {}, netImpl) {
  stubElectron(protocolImpl, netImpl)
  delete require.cache[protocolPath]
  return require(protocolPath)
}

function writeWidget (root, id, files) {
  const dir = path.join(root, 'widgets', id)
  fs.mkdirSync(dir, { recursive: true })
  Object.entries(files).forEach(([name, content]) => {
    const file = path.join(dir, name)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, content)
  })
}

const WIDGET_FILES = {
  'ui/index.html': '<html><head><title>x</title></head><body>hi</body></html>',
  'ui/app.js': 'console.log(1)',
  'ui/style.css': 'body{color:red}',
  'ui/logo.svg': '<svg/>',
  'ui/data.weird': 'raw'
}

before(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-widget-protocol-'))
  tmpData = path.join(tmp, 'data')
  process.env.DATA_PATH = tmpData
  writeWidget(tmpData, 'hello-ui', WIDGET_FILES)
  proto = loadProtocol()
})

after(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
  delete require.cache[electronPath]
  delete require.cache[protocolPath]
  delete process.env.DATA_PATH
})

describe('resolveWidgetRequest', () => {
  it('serves the widget html with the bridge injected first in head', () => {
    const res = proto.resolveWidgetRequest('electerm-widget://hello-ui/ui/index.html')
    assert.equal(res.status, 200)
    assert.match(res.mimeType, /^text\/html/)
    const html = res.body.toString('utf8')
    assert.match(html, /<head><script src="\/__bridge\.js"><\/script><title>/)
  })

  it('serves the bridge script itself', () => {
    const res = proto.resolveWidgetRequest('electerm-widget://hello-ui/__bridge.js')
    assert.equal(res.status, 200)
    assert.match(res.mimeType, /^text\/javascript/)
    assert.match(res.body.toString('utf8'), /window\.electerm/)
  })

  it('hands static files over with a mime type the callback protocol can use', () => {
    const js = proto.resolveWidgetRequest('electerm-widget://hello-ui/ui/app.js')
    assert.equal(js.status, 200)
    assert.equal(js.mimeType, 'text/javascript; charset=utf-8')
    assert.ok(js.file.endsWith(path.join('ui', 'app.js')))

    const css = proto.resolveWidgetRequest('electerm-widget://hello-ui/ui/style.css')
    assert.equal(css.mimeType, 'text/css; charset=utf-8')

    const svg = proto.resolveWidgetRequest('electerm-widget://hello-ui/ui/logo.svg')
    assert.equal(svg.mimeType, 'image/svg+xml')

    const unknown = proto.resolveWidgetRequest('electerm-widget://hello-ui/ui/data.weird')
    assert.equal(unknown.mimeType, 'application/octet-stream')
  })

  it('rejects everything it should', () => {
    const cases = [
      'electerm-widget://hello-ui/',
      'electerm-widget://hello-ui/../secret.txt',
      'electerm-widget://hello-ui/ui/../../secret.txt',
      'electerm-widget://Bad_Id/ui/index.html',
      'electerm-widget://hello-ui/ui/missing.js',
      'electerm-widget://hello-ui/ui',
      'not a url'
    ]
    cases.forEach(u => {
      assert.equal(proto.resolveWidgetRequest(u).status, 404, u)
    })
  })
})

describe('modern adapter (Electron >= 25)', () => {
  it('registers the scheme through protocol.handle', () => {
    const calls = []
    const p = loadProtocol({
      handle: (scheme, handler) => calls.push([scheme, handler])
    })
    p.initWidgetProtocol()
    assert.equal(calls.length, 1)
    assert.equal(calls[0][0], 'electerm-widget')
  })

  it('answers with a Response carrying the type from the resolver', async () => {
    const res = await proto.serveWidgetFile({
      url: 'electerm-widget://hello-ui/ui/index.html'
    })
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('content-type'), 'text/html; charset=utf-8')
    assert.match(await res.text(), /__bridge\.js/)
  })

  it('reports a miss as a 404 Response', async () => {
    const res = await proto.serveWidgetFile({
      url: 'electerm-widget://hello-ui/ui/missing.js'
    })
    assert.equal(res.status, 404)
  })

  it('lets net.fetch stream plain files off disk', async () => {
    const seen = []
    const p = loadProtocol({}, {
      fetch: url => {
        seen.push(url)
        return Promise.resolve({ fromNet: true })
      }
    })
    const res = await p.serveWidgetFile({
      url: 'electerm-widget://hello-ui/ui/app.js'
    })
    assert.deepEqual(res, { fromNet: true })
    assert.equal(seen.length, 1)
    assert.match(seen[0], /^file:\/\/.*ui\/app\.js$/)
  })
})

describe('legacy adapter (Electron < 25)', () => {
  const legacy = require(legacyPath)
  const resolve = url => proto.resolveWidgetRequest(url)

  function serve (url) {
    let got
    legacy.serveWidgetFile({ url }, resolve, res => {
      got = res
    })
    return got
  }

  it('registers the scheme through the callback protocol', () => {
    const calls = []
    legacy.initWidgetProtocol(
      { registerBufferProtocol: (scheme, handler) => calls.push([scheme, handler]) },
      'electerm-widget',
      resolve
    )
    assert.equal(calls.length, 1)
    assert.equal(calls[0][0], 'electerm-widget')
  })

  it('calls back with a bare mime type plus charset, and the data', () => {
    const got = serve('electerm-widget://hello-ui/ui/index.html')
    // Electron 22 treats "text/html; charset=utf-8" as plain text: the charset
    // has to be its own field or the widget html is never parsed.
    assert.equal(got.mimeType, 'text/html')
    assert.equal(got.charset, 'utf-8')
    assert.ok(Buffer.isBuffer(got.data))
    assert.match(got.data.toString('utf8'), /__bridge\.js/)
  })

  it('keeps the charset off binary assets', () => {
    const got = serve('electerm-widget://hello-ui/ui/logo.svg')
    assert.equal(got.mimeType, 'image/svg+xml')
    assert.equal('charset' in got, false)
  })

  it('reports a missing file as a net error, not as an empty 200', () => {
    assert.deepEqual(serve('electerm-widget://hello-ui/ui/missing.js'), { error: -6 })
  })

  it('survives a resolver that throws', () => {
    let got
    legacy.serveWidgetFile({ url: 'x' }, () => {
      throw new Error('boom')
    }, res => {
      got = res
    })
    assert.deepEqual(got, { error: -6 })
  })
})

describe('build-time injection', () => {
  const silent = () => {}
  let tree

  function makeTree (electronVersion) {
    // Under node_modules: git-ignored build space, and `require('electron')`
    // from the copied app still resolves to the stubbed module in the spec.
    const root = fs.mkdtempSync(path.join(REPO, 'node_modules/.tmp-inject-'))
    fs.cpSync(path.join(REPO, 'src/app/widgets'), path.join(root, 'work/app/widgets'), {
      recursive: true
    })
    fs.mkdirSync(path.join(root, 'src/build/polyfills/electron-lt25'), { recursive: true })
    fs.copyFileSync(
      path.join(REPO, 'src/build/polyfills/electron-lt25/protocol-legacy.js'),
      path.join(root, 'src/build/polyfills/electron-lt25/protocol-legacy.js')
    )
    fs.writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({ devDependencies: { electron: electronVersion } })
    )
    return root
  }

  const readProtocol = root => fs.readFileSync(path.join(root, 'work/app/widgets/protocol.js'), 'utf8')

  before(() => {
    tree = makeTree('22.3.27')
  })

  after(() => {
    fs.rmSync(tree, { recursive: true, force: true })
  })

  it('reads the pinned electron version', () => {
    assert.equal(electronMajorVersion(tree), 22)
    const modern = makeTree('44.7.0')
    try {
      assert.equal(electronMajorVersion(modern), 44)
    } finally {
      fs.rmSync(modern, { recursive: true, force: true })
    }
  })

  // prepare.js does `require('./inject-polyfills').main()`, so the entrypoint
  // has to be exported. Missing it breaks every build with
  // "require(...).main is not a function" instead of doing the injection.
  it('exports the entrypoint prepare.js calls', () => {
    assert.equal(typeof injectPolyfillsEntry, 'function')
  })

  it('patches the packaged app for Electron 22 and copies the adapter', () => {
    const applied = applyPolyfills({ root: tree, major: 22, log: silent })
    assert.deepEqual(applied, ['widget protocol callback adapter'])
    const code = readProtocol(tree)
    assert.match(code, /require\('\.\/protocol-legacy'\)\.initWidgetProtocol\(protocol, SCHEME, resolveWidgetRequest\)/)
    assert.doesNotMatch(code, /protocol\.handle\(SCHEME, serveWidgetFile\)/)
    assert.ok(fs.existsSync(path.join(tree, 'work/app/widgets/protocol-legacy.js')))
  })

  it('is idempotent', () => {
    const before = readProtocol(tree)
    applyPolyfills({ root: tree, major: 22, log: silent })
    assert.equal(readProtocol(tree), before)
  })

  // The win7-tar runner checks out with core.autocrlf=true, so the anchor has to
  // match a CRLF file — otherwise every Windows legacy build dies with
  // "expected block not found".
  it('patches a CRLF checkout and keeps its line endings', () => {
    const crlf = makeTree('22.3.27')
    try {
      const file = path.join(crlf, 'work/app/widgets/protocol.js')
      const original = fs.readFileSync(file, 'utf8').replace(/\r?\n/g, '\r\n')
      fs.writeFileSync(file, original)
      assert.deepEqual(
        applyPolyfills({ root: crlf, major: 22, log: silent }),
        ['widget protocol callback adapter']
      )
      const code = fs.readFileSync(file, 'utf8')
      assert.match(code, /require\('\.\/protocol-legacy'\)/)
      assert.doesNotMatch(code, /[^\r]\n/, 'every newline should still be CRLF')
      // and it stays put on a second run
      applyPolyfills({ root: crlf, major: 22, log: silent })
      assert.equal(fs.readFileSync(file, 'utf8'), code)
    } finally {
      fs.rmSync(crlf, { recursive: true, force: true })
    }
  })

  it('leaves the source tree alone', () => {
    assert.doesNotMatch(
      fs.readFileSync(path.join(REPO, 'src/app/widgets/protocol.js'), 'utf8'),
      /require\('\.\/protocol-legacy'\)/
    )
  })

  it('does nothing for a modern target', () => {
    const modern = makeTree('44.7.0')
    try {
      assert.deepEqual(applyPolyfills({ root: modern, major: 44, log: silent }), [])
      assert.equal(
        readProtocol(modern),
        fs.readFileSync(path.join(REPO, 'src/app/widgets/protocol.js'), 'utf8')
      )
      assert.equal(
        fs.existsSync(path.join(modern, 'work/app/widgets/protocol-legacy.js')),
        false
      )
    } finally {
      fs.rmSync(modern, { recursive: true, force: true })
    }
  })

  it('skips when the electron version cannot be read', () => {
    const odd = makeTree('latest')
    try {
      assert.deepEqual(applyPolyfills({ root: odd, major: null, log: silent }), [])
      assert.doesNotMatch(readProtocol(odd), /require\('\.\/protocol-legacy'\)/)
    } finally {
      fs.rmSync(odd, { recursive: true, force: true })
    }
  })

  it('fails loudly when protocol.js no longer has the anchor', () => {
    const drift = makeTree('22.3.27')
    try {
      const file = path.join(drift, 'work/app/widgets/protocol.js')
      fs.writeFileSync(
        file,
        fs.readFileSync(file, 'utf8').replace(
          'protocol.handle(SCHEME, serveWidgetFile)',
          'protocol.handle(SCHEME, serveWidgetFileV2)'
        )
      )
      assert.throws(
        () => applyPolyfills({ root: drift, major: 22, log: silent }),
        /cannot patch work\/app\/widgets\/protocol\.js/
      )
    } finally {
      fs.rmSync(drift, { recursive: true, force: true })
    }
  })

  it('produces an app that loads and serves on Electron 22', () => {
    // The wiring a legacy build really runs: patched protocol.js + injected
    // adapter, loaded with an electron stub that only has the old API.
    const calls = []
    stubElectron({
      registerBufferProtocol: (scheme, handler) => calls.push([scheme, handler])
    })
    const patched = path.join(tree, 'work/app/widgets/protocol.js')
    for (const key of Object.keys(require.cache)) {
      if (key.startsWith(path.dirname(patched))) {
        delete require.cache[key]
      }
    }
    const app = require(patched)
    app.initWidgetProtocol()
    assert.equal(calls.length, 1)
    assert.equal(calls[0][0], 'electerm-widget')

    let got
    calls[0][1]({ url: 'electerm-widget://hello-ui/ui/index.html' }, res => {
      got = res
    })
    assert.equal(got.mimeType, 'text/html')
    assert.equal(got.charset, 'utf-8')
    assert.match(got.data.toString('utf8'), /__bridge\.js/)
  })
})
