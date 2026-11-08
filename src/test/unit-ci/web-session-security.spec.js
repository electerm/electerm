/**
 * Unit tests for the web session guest hardening (GHSA-m7mf-jvqh-8wwh) and for
 * origin-bound Basic auth headers (GHSA-3mh6-qf3v-q6cr).
 *
 * A web session renders a URL the user did not write, and the component used to
 * create that <webview> with `disablewebsecurity='true'` — same-origin policy
 * off, so the page could read cloud metadata, localhost panels and `file://`
 * URLs. The attribute is gone; webview-handler.js is the main-process lock that
 * keeps a renderer from asking for it again. Both halves are asserted here, and
 * the handler is exercised for real (mocked electron, real EventEmitter) rather
 * than grepped.
 *
 * The header listener used to be stubbed to a no-op here, which is why the
 * credential leak survived the hardening pass. It is captured now and driven
 * through the same IPC path the renderer uses.
 */

const { test, describe } = require('node:test')
const assert = require('assert/strict')
const fs = require('fs')
const path = require('path')
const { EventEmitter } = require('events')
const Module = require('module')

const srcRoot = path.join(__dirname, '../../../src')

let ipcHandler = null
let lastAuthRequest = null

const mockIpcMain = {
  on (channel, fn) {
    if (channel === 'webview-auth-response') ipcHandler = fn
  },
  listenerCount () { return 0 },
  removeListener () {}
}

const originalLoad = Module._load.bind(Module)
Module._load = function (request, parent, isMain) {
  if (request === 'electron') {
    return {
      ipcMain: mockIpcMain,
      webContents: { fromId () { return null } }
    }
  }
  return originalLoad(request, parent, isMain)
}
const webviewHandler = require(path.join(srcRoot, 'app/lib/webview-handler.js'))
Module._load = originalLoad

function createGuest (opts = {}) {
  const guest = new EventEmitter()
  guest.id = opts.id || 7
  guest.getType = () => 'webview'
  guest.session = opts.session || createSession()
  guest.windowOpenHandler = null
  guest.setWindowOpenHandler = fn => { guest.windowOpenHandler = fn }
  guest.executeJavaScript = () => Promise.resolve('{}')
  guest.getURL = () => 'https://example.com/'
  guest.reload = () => {}
  // setupWebview() schedules an auth probe; keep it inert so it cannot outlive
  // the test
  guest.isDestroyed = () => true
  return guest
}

function createSession () {
  const session = {
    headerFn: null,
    headerFilter: null,
    permissionHandler: null,
    checkHandler: null,
    setPermissionRequestHandler (fn) { this.permissionHandler = fn },
    setPermissionCheckHandler (fn) { this.checkHandler = fn }
  }
  session.webRequest = {
    onBeforeSendHeaders (filterOrFn, maybeFn) {
      if (typeof filterOrFn === 'function') {
        session.headerFn = filterOrFn
      } else {
        session.headerFilter = filterOrFn
        session.headerFn = maybeFn
      }
    }
  }
  return session
}

// embedder: the main window whose renderer creates <webview> tags
function createWindow () {
  const win = new EventEmitter()
  win.webContents = new EventEmitter()
  win.webContents.send = (channel, data) => {
    if (channel === 'webview-auth-request') lastAuthRequest = data
  }
  return win
}

function attachWebview (win, guest, prefs = {}, params = {}) {
  // will-attach-webview fires with the preferences parsed from the attributes
  // before the guest exists; did-attach-webview then hands over the webContents.
  let prevented = false
  const event = { preventDefault () { prevented = true } }
  const parsed = { ...prefs }
  win.webContents.emit('will-attach-webview', event, parsed, { ...params })
  if (!prevented) {
    win.webContents.emit('did-attach-webview', {}, guest)
  }
  return { prevented, prefs: parsed }
}

describe('web session guest hardening', () => {
  test('the component no longer asks for a webview without same-origin policy', () => {
    const file = path.join(srcRoot, 'client/components/web/web-session.jsx')
    const source = fs.readFileSync(file, 'utf8')
    // matches the attribute in JSX (`disablewebsecurity='true'`) and in the
    // props object (`disablewebsecurity: 'true'`), but not prose in comments
    assert.equal(
      /disablewebsecurity\s*[:=]/.test(source), false,
      'disablewebsecurity must not appear in the <webview> props (see GHSA-m7mf-jvqh-8wwh)'
    )
    assert.equal(
      /disableblinkfeatures\s*[:=]/.test(source), false,
      'disableblinkfeatures was a no-op ("true" is not a feature list) and should stay gone'
    )
  })

  test('main process turns same-origin policy back on even if the renderer asks for it off', () => {
    const win = createWindow()
    webviewHandler.init(win)
    const { prevented, prefs } = attachWebview(win, createGuest(), {
      webSecurity: false,
      allowRunningInsecureContent: true,
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true,
      preload: '/tmp/evil.js'
    }, { src: 'http://example.com/' })

    assert.equal(prevented, false)
    assert.equal(prefs.webSecurity, true)
    assert.equal(prefs.allowRunningInsecureContent, false)
    assert.equal(prefs.nodeIntegration, false)
    assert.equal(prefs.contextIsolation, true)
    assert.equal(prefs.webviewTag, false)
    assert.equal(prefs.preload, undefined)
  })

  test('only http and https pages may be embedded', () => {
    const win = createWindow()
    webviewHandler.init(win)

    for (const src of ['file:///etc/passwd', 'electerm://x', 'javascript:alert(1)', '']) {
      const { prevented } = attachWebview(win, createGuest(), {}, { src })
      assert.equal(prevented, true, `${src || '(empty)'} should be rejected`)
    }

    for (const src of ['http://192.168.1.1/', 'https://example.com/page']) {
      const { prevented } = attachWebview(win, createGuest(), {}, { src })
      assert.equal(prevented, false, `${src} should be allowed`)
    }
  })

  test('guest popups are limited to http(s) and get no privileges', () => {
    const win = createWindow()
    webviewHandler.init(win)
    const guest = createGuest()
    attachWebview(win, guest, {}, { src: 'https://example.com/' })

    assert.equal(typeof guest.windowOpenHandler, 'function')
    const allowed = guest.windowOpenHandler({ url: 'https://login.example.com/' })
    assert.equal(allowed.action, 'allow')
    assert.equal(allowed.overrideBrowserWindowOptions.webPreferences.webSecurity, true)
    assert.equal(allowed.overrideBrowserWindowOptions.webPreferences.nodeIntegration, false)
    assert.equal(allowed.overrideBrowserWindowOptions.webPreferences.webviewTag, false)

    for (const url of ['file:///etc/passwd', 'electerm://evil', 'about:blank']) {
      assert.equal(guest.windowOpenHandler({ url }).action, 'deny', `${url} should be denied`)
    }
  })

  test('guest permission requests for devices are denied, the main window is untouched', () => {
    const win = createWindow()
    webviewHandler.init(win)
    const session = createSession()
    attachWebview(win, createGuest({ session }), {}, { src: 'https://example.com/' })

    const ask = (wc, permission) => {
      let granted = null
      session.permissionHandler(wc, permission, v => { granted = v })
      return granted
    }

    const guest = { getType: () => 'webview' }
    for (const p of ['media', 'geolocation', 'hid', 'serial', 'usb', 'clipboard-read']) {
      assert.equal(ask(guest, p), false, `${p} should be denied for a guest`)
    }
    for (const p of ['notifications', 'fullscreen', 'clipboard-sanitized-write']) {
      assert.equal(ask(guest, p), true, `${p} should stay available for a guest`)
    }
    assert.equal(ask({ getType: () => 'window' }, 'media'), true)
    assert.equal(ask(null, 'media'), true)
  })

  test('guest permission checks are denied too, not just permission requests', () => {
    const win = createWindow()
    webviewHandler.init(win)
    const session = createSession()
    attachWebview(win, createGuest({ session }), {}, { src: 'https://example.com/' })

    assert.equal(typeof session.checkHandler, 'function')
    const check = (wc, permission) => session.checkHandler(
      wc, permission, 'https://example.com', {}
    )

    const guest = { getType: () => 'webview' }
    for (const p of ['media', 'geolocation', 'midi', 'midiSysex', 'hid', 'serial', 'usb', 'idle-detection', 'clipboard-read']) {
      assert.equal(check(guest, p), false, `${p} check should be denied for a guest`)
    }
    for (const p of ['notifications', 'fullscreen', 'clipboard-sanitized-write']) {
      assert.equal(check(guest, p), true, `${p} check should stay available for a guest`)
    }
    assert.equal(check({ getType: () => 'window' }, 'media'), true)
    // A check not tied to a document (service worker, notification) arrives
    // with a null webContents; keep Electron's previous default for those.
    assert.equal(check(null, 'media'), true)
  })
})

// The credentials the user types for host A used to be attached to every
// request from that webContents, because the only key was webContentsId. That
// id does not change for cross-origin subresources or top-level navigations.
describe('web session Basic auth is bound to one origin', () => {
  const A = 'http://127.0.0.1:45871/'
  const B = 'http://127.0.0.1:45872/steal'
  const C = 'http://127.0.0.1:45873/nav'
  let nextGuestId = 100

  function authHarness (url = A) {
    lastAuthRequest = null
    const session = createSession()
    const guest = createGuest({ session, id: nextGuestId++ })
    guest.isDestroyed = () => false
    guest.getURL = () => url
    guest.executeJavaScript = () => Promise.resolve({ status: 'unauthorized' })
    const win = createWindow()
    webviewHandler.init(win)
    win.webContents.emit('did-attach-webview', {}, guest)
    return { session, guest }
  }

  async function raisePrompt (guest) {
    guest.emit('dom-ready')
    await new Promise(resolve => setTimeout(resolve, 20))
    assert.ok(lastAuthRequest, 'the credential prompt should have been raised')
    return lastAuthRequest
  }

  function submit (id, username = 'corp-user', password = 'CorpP4ssw0rd!') {
    ipcHandler({}, { id, username, password })
  }

  function headersFor (session, guest, url, details = {}) {
    let headers
    session.headerFn({
      webContentsId: guest.id,
      url,
      requestHeaders: { 'X-Original': '1' },
      ...details
    }, r => { headers = r.requestHeaders })
    return headers
  }

  function decoded (headers) {
    const auth = headers && headers.Authorization
    return auth
      ? Buffer.from(auth.replace(/^Basic /, ''), 'base64').toString()
      : null
  }

  // setupWebview() leaves a 500 ms probe timer behind. Making the guest
  // destroyed after each test keeps it inert, and the destroyed handler also
  // clears that guest's credentials so tests cannot leak state into each other.
  function cleanup (guest) {
    guest.isDestroyed = () => true
    guest.emit('destroyed')
  }

  test('credentials reach the prompted origin, not any other origin', async () => {
    const { session, guest } = authHarness(A)
    const req = await raisePrompt(guest)
    assert.equal(req.host, '127.0.0.1:45871')
    submit(req.id)

    assert.equal(decoded(headersFor(session, guest, A)), 'corp-user:CorpP4ssw0rd!')
    assert.equal(decoded(headersFor(session, guest, B)), null)
    assert.equal(decoded(headersFor(session, guest, C)), null)
    assert.equal(headersFor(session, guest, A)['X-Original'], '1')
    cleanup(guest)
  })

  test('a different scheme or port is a different origin', async () => {
    const { session, guest } = authHarness(A)
    submit((await raisePrompt(guest)).id)

    assert.equal(decoded(headersFor(session, guest, 'https://127.0.0.1:45871/')), null)
    assert.equal(decoded(headersFor(session, guest, 'http://127.0.0.1:45899/')), null)
    assert.equal(decoded(headersFor(session, guest, 'http://127.0.0.1:45871/page?q=1')), 'corp-user:CorpP4ssw0rd!')
    cleanup(guest)
  })

  test('a malformed request url cannot throw or acquire credentials', async () => {
    const { session, guest } = authHarness(A)
    submit((await raisePrompt(guest)).id)

    const headers = headersFor(session, guest, 'not a url')
    assert.equal(decoded(headers), null)
    assert.equal(headers['X-Original'], '1')
    cleanup(guest)
  })

  test('Electron 22 details with no webContentsId still resolve the guest', async () => {
    const { session, guest } = authHarness(A)
    submit((await raisePrompt(guest)).id)
    // Electron 22 marks webContentsId as optional; `webContents` is still on
    // the details object there, and the feature must keep working on those
    // builds rather than silently dropping every Authorization header.
    const legacy = { webContentsId: undefined, webContents: { id: guest.id } }

    assert.equal(decoded(headersFor(session, guest, A, legacy)), 'corp-user:CorpP4ssw0rd!')
    assert.equal(decoded(headersFor(session, guest, B, legacy)), null)
    cleanup(guest)
  })

  test('a request with no webContents association never gets credentials', async () => {
    const { session, guest } = authHarness(A)
    submit((await raisePrompt(guest)).id)
    const detached = { webContentsId: undefined }

    const headers = headersFor(session, guest, A, detached)
    assert.equal(decoded(headers), null)
    assert.equal(headers['X-Original'], '1')
    cleanup(guest)
  })

  test('the listener is filtered to http(s) so it cannot stall other schemes', () => {
    const { session, guest } = authHarness(A)
    assert.deepEqual(session.headerFilter, { urls: ['http://*/*', 'https://*/*'] })
    cleanup(guest)
  })

  test('a non-http guest url cannot raise a credential prompt', async () => {
    const { guest } = authHarness('file:///etc/passwd')
    guest.emit('dom-ready')
    await new Promise(resolve => setTimeout(resolve, 20))
    assert.equal(lastAuthRequest, null)
    cleanup(guest)
  })

  test('navigating away from the origin drops the stored credentials', async () => {
    const { session, guest } = authHarness(A)
    submit((await raisePrompt(guest)).id)
    assert.equal(decoded(headersFor(session, guest, A)), 'corp-user:CorpP4ssw0rd!')

    guest.isDestroyed = () => true
    guest.emit('did-navigate', {}, C)
    assert.equal(decoded(headersFor(session, guest, A)), null)
    cleanup(guest)
  })

  test('a same-origin reload keeps the credentials', async () => {
    const { session, guest } = authHarness(A)
    submit((await raisePrompt(guest)).id)

    guest.isDestroyed = () => true
    guest.emit('did-navigate', {}, A)
    assert.equal(decoded(headersFor(session, guest, A)), 'corp-user:CorpP4ssw0rd!')
    cleanup(guest)
  })

  test('cancelling the prompt clears credentials', async () => {
    const { session, guest } = authHarness(A)
    const req = await raisePrompt(guest)
    ipcHandler({}, { id: req.id, username: '', password: '' })
    assert.equal(decoded(headersFor(session, guest, A)), null)
    cleanup(guest)
  })
})
