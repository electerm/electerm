/**
 * session channel env tests (electerm#4670)
 *
 * electerm used to always send an `env LANG=...` request on the session
 * channel before pty/shell. OpenSSH sends none by default, and some ssh
 * gateways drop the connection on it. A cleared envLang field now means
 * "send no env at all" instead of falling back to en_US.UTF-8.
 */

const { test, describe } = require('node:test')
const assert = require('assert/strict')

const { commonExtends } = require('../../../src/app/server/session-common')

function makeSession (initOptions = {}) {
  class FakeSession {}
  FakeSession.prototype.initOptions = initOptions
  commonExtends(FakeSession)
  return new FakeSession()
}

describe('session env', () => {
  test('empty envLang sends no LANG', () => {
    const session = makeSession({ envLang: '' })
    assert.deepEqual(session.getEnv(), {})
  })

  test('missing envLang sends no LANG', () => {
    const session = makeSession({})
    assert.deepEqual(session.getEnv(), {})
  })

  test('explicit envLang is sent as LANG', () => {
    const session = makeSession({ envLang: 'zh_CN.UTF-8' })
    assert.deepEqual(session.getEnv(), {
      LANG: 'zh_CN.UTF-8'
    })
  })

  test('custom setEnv is kept and can override LANG', () => {
    const session = makeSession({
      envLang: 'en_US.UTF-8',
      setEnv: 'LC_ALL=C LANG=ja_JP.UTF-8 TERM=xterm'
    })
    assert.deepEqual(session.getEnv(), {
      LC_ALL: 'C',
      LANG: 'ja_JP.UTF-8',
      TERM: 'xterm'
    })
  })

  test('custom setEnv alone never resurrects LANG', () => {
    const session = makeSession({ envLang: '', setEnv: 'LC_ALL=C' })
    assert.deepEqual(session.getEnv(), {
      LC_ALL: 'C'
    })
  })

  test('exec opts follow the same rule', () => {
    assert.deepEqual(makeSession({ envLang: '' }).getExecOpts(), { env: {} })
  })
})
