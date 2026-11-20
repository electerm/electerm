const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const {
  parseOrigin,
  isSameOrigin,
  installNavGuard
} = require('../../app/lib/nav-guard')

const APP_URL = 'http://127.0.0.1:5570/index.html?v=5.11.8'
const APP_ORIGIN = 'http://127.0.0.1:5570'

function fakeWin () {
  const handlers = {}
  let openHandler
  return {
    win: {
      webContents: {
        on: (name, cb) => {
          handlers[name] = cb
        },
        setWindowOpenHandler: cb => {
          openHandler = cb
        }
      }
    },
    handlers,
    openWindow: url => openHandler({ url })
  }
}

function fakeShell () {
  const opened = []
  return {
    opened,
    shell: {
      openExternal: url => {
        opened.push(url)
      }
    }
  }
}

function guard () {
  const { win, handlers, openWindow } = fakeWin()
  const { opened, shell } = fakeShell()
  const origin = installNavGuard(win, APP_URL, shell)
  const navigate = (name, url) => {
    let prevented = false
    handlers[name]({ preventDefault: () => { prevented = true } }, url)
    return prevented
  }
  return { origin, opened, navigate, openWindow }
}

describe('parseOrigin', () => {
  it('returns the origin of an absolute url', () => {
    assert.equal(parseOrigin(APP_URL), APP_ORIGIN)
  })

  it('returns empty string for anything unparsable', () => {
    assert.equal(parseOrigin(''), '')
    assert.equal(parseOrigin(undefined), '')
    assert.equal(parseOrigin('not a url'), '')
  })
})

describe('isSameOrigin', () => {
  it('ignores path, query and hash', () => {
    assert.ok(isSameOrigin(APP_URL, APP_ORIGIN))
    assert.ok(isSameOrigin(APP_ORIGIN + '/other/route?a=1#h', APP_ORIGIN))
  })

  it('rejects a different port, host or scheme', () => {
    assert.ok(!isSameOrigin('http://127.0.0.1:5571/index.html', APP_ORIGIN))
    assert.ok(!isSameOrigin('http://localhost:5570/index.html', APP_ORIGIN))
    assert.ok(!isSameOrigin('https://127.0.0.1:5570/index.html', APP_ORIGIN))
    assert.ok(!isSameOrigin('file:///tmp/poc.html', APP_ORIGIN))
  })

  it('rejects everything when the origin is unknown', () => {
    assert.ok(!isSameOrigin(APP_URL, undefined))
    assert.ok(!isSameOrigin(APP_URL, ''))
  })
})

describe('installNavGuard', () => {
  it('returns the app origin', () => {
    assert.equal(guard().origin, APP_ORIGIN)
  })

  it('refuses to install without an absolute app url', () => {
    const { win } = fakeWin()
    const { shell } = fakeShell()
    assert.throws(() => installNavGuard(win, '/index.html', shell), /absolute url/)
  })

  it('lets the app itself navigate', () => {
    const { navigate } = guard()
    assert.ok(!navigate('will-navigate', APP_URL))
    assert.ok(!navigate('will-navigate', APP_ORIGIN + '/index.html?v=5.11.9'))
    assert.ok(!navigate('will-redirect', APP_ORIGIN + '/index.html'))
  })

  it('blocks navigation away and hands it to the browser', () => {
    const g = guard()
    assert.ok(g.navigate('will-navigate', 'https://attacker.example/poc.html'))
    assert.deepEqual(g.opened, ['https://attacker.example/poc.html'])
  })

  it('blocks redirects away from the app', () => {
    const g = guard()
    assert.ok(g.navigate('will-redirect', 'https://attacker.example/poc.html'))
    assert.deepEqual(g.opened, ['https://attacker.example/poc.html'])
  })

  it('blocks without dispatching schemes the browser cannot route', () => {
    const g = guard()
    for (const url of [
      'file:///etc/passwd',
      'javascript:alert(1)',
      'data:text/html,<h1>poc</h1>',
      'electerm://cmd'
    ]) {
      assert.ok(g.navigate('will-navigate', url), url)
    }
    assert.deepEqual(g.opened, [])
  })

  it('denies window.open and sends the url to the browser instead', () => {
    const g = guard()
    assert.deepEqual(g.openWindow('https://attacker.example/poc.html'), { action: 'deny' })
    assert.deepEqual(g.opened, ['https://attacker.example/poc.html'])
  })

  it('denies window.open for unroutable schemes without dispatching', () => {
    const g = guard()
    assert.deepEqual(g.openWindow('file:///etc/passwd'), { action: 'deny' })
    assert.deepEqual(g.opened, [])
  })
})
