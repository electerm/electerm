/**
 * Unit tests for the web session guest hardening (GHSA-m7mf-jvqh-8wwh).
 *
 * A web session renders a URL the user did not write, and the component used to
 * create that <webview> with `disablewebsecurity='true'` — same-origin policy
 * off, so the page could read cloud metadata, localhost panels and `file://`
 * URLs. The attribute is gone; webview-handler.js is the main-process lock that
 * keeps a renderer from asking for it again. Both halves are asserted here, and
 * the handler is exercised for real (mocked electron, real EventEmitter) rather
 * than grepped.
 */

const { test, describe } = require('node:test')
const assert = require('assert/strict')
const fs = require('fs')
const path = require('path')
const { EventEmitter } = require('events')
const Module = require('module')

const srcRoot = path.join(__dirname, '../../../src')

const mockIpcMain = {
  on () {},
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
  // setupWebview() schedules an auth probe; keep it inert so it cannot outlive
  // the test
  guest.isDestroyed = () => true
  return guest
}

function createSession () {
  return {
    webRequest: { onBeforeSendHeaders () {} },
    permissionHandler: null,
    setPermissionRequestHandler (fn) { this.permissionHandler = fn }
  }
}

// embedder: the main window whose renderer creates <webview> tags
function createWindow () {
  const win = new EventEmitter()
  win.webContents = new EventEmitter()
  win.webContents.send = () => {}
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
  })
})
