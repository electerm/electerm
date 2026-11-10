const { describe, test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

// Password manager widgets: `electerm.credentialProvider` in package.json,
// listed with the widget, called through callWidgetFunc. Only a bookmark with
// `usePasswordManager` is ever handed to them.

let tmp
let registry
let userWidget
let utils

function writeWidget (id, electerm, main) {
  const dir = path.join(tmp, 'widgets', id)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
    name: id,
    version: '1.0.0',
    main: 'main.js',
    electerm: { type: 'frontend', ...electerm }
  }))
  fs.writeFileSync(path.join(dir, 'main.js'), main)
}

before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-credential-provider-test-'))
  process.env.DATA_PATH = tmp
  registry = require('../../app/widgets/load-widget')
  userWidget = require('../../app/widgets/user-widget')
  utils = await import('../../client/common/credential-provider-utils.js')
})

after(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
  delete process.env.DATA_PATH
})

describe('credential provider widgets', () => {
  test('the manifest names are listed, invalid ones dropped', () => {
    writeWidget('vault', {
      name: 'Vault',
      credentialProvider: { get: 'getCredentials', save: 'saveCredentials' }
    }, `
      module.exports = {
        getCredentials: t => ({ pick: { login: 'alice', password: 'pw-' + t.host } }),
        saveCredentials: () => ({ ok: true })
      }
    `)
    writeWidget('plain', { name: 'Plain' }, 'module.exports = {}\n')
    const list = userWidget.listUserWidgets()
    assert.deepEqual(list.find(w => w.id === 'vault').info.credentialProvider, { get: 'getCredentials', save: 'saveCredentials' })
    assert.equal(list.find(w => w.id === 'plain').info.credentialProvider, undefined)
    assert.equal(userWidget.sanitizeCredentialProvider({ get: 'a b' }), undefined)
    assert.deepEqual(userWidget.sanitizeCredentialProvider({ get: 'g', save: 'x;y' }), { get: 'g', save: '' })
    assert.equal(userWidget.sanitizeCredentialProvider('get'), undefined)
  })

  test('the first usable provider is picked, always the same one', () => {
    assert.deepEqual(utils.providerOf(registry.listWidgets()), { id: 'vault', name: 'Vault', get: 'getCredentials', save: 'saveCredentials' })
    assert.equal(utils.providerOf([{ id: 'x', state: 'error', info: { credentialProvider: { get: 'g' } } }]), null)
    assert.equal(utils.providerOf(undefined), null)
    assert.deepEqual(utils.providerOf([{ id: 'y', state: 'ok', info: { credentialProvider: { get: 'g' } } }]), { id: 'y', name: 'y', get: 'g', save: '' })
    // several providers: independent of the order they were listed in
    const two = (a, b) => [
      { id: a, state: 'ok', info: { name: a, credentialProvider: { get: 'g' } } },
      { id: b, state: 'ok', info: { name: b, credentialProvider: { get: 'g' } } }
    ]
    assert.equal(utils.providerOf(two('zeta', 'alpha')).id, 'alpha')
    assert.equal(utils.providerOf(two('alpha', 'zeta')).id, 'alpha')
  })

  test('only a bookmark that opts in is asked', () => {
    const tab = { type: 'ssh', host: 'server1', port: 22, username: 'alice' }
    assert.equal(utils.wantsProvider(tab), false)
    assert.equal(utils.wantsProvider({ ...tab, usePasswordManager: false }), false)
    assert.equal(utils.wantsProvider({ ...tab, usePasswordManager: true }), true)
    // a password of its own wins: the provider is not asked at all
    assert.equal(utils.wantsProvider({ ...tab, usePasswordManager: true, password: 'x' }), false)
    assert.equal(utils.wantsProvider({ ...tab, usePasswordManager: true, host: '' }), false)
    assert.equal(utils.wantsProvider({ ...tab, usePasswordManager: true, type: 'serial' }), false)
    assert.equal(utils.wantsProvider(null), false)
    for (const type of utils.PASSWORD_TYPES) {
      assert.equal(utils.wantsProvider({ ...tab, type, usePasswordManager: true }), true, type)
    }
    // no type on old bookmarks means ssh
    assert.equal(utils.wantsProvider({ host: 'h', usePasswordManager: true }), true)
  })

  test('a login can only be kept where a prompt asks for it', () => {
    assert.equal(utils.canCreateEntry({ type: 'ssh' }), true)
    assert.equal(utils.canCreateEntry({ type: 'rdp' }), true)
    assert.equal(utils.canCreateEntry({ type: 'vnc' }), false)
    assert.equal(utils.canCreateEntry({ type: 'spice' }), false)
    assert.equal(utils.canCreateEntry({ type: 'ftp' }), false)
    assert.equal(utils.canCreateEntry({ type: 'telnet' }), false)
  })

  test('get is called with the target, never a password', async () => {
    const target = utils.credentialTarget({ host: 'server1', port: 22, username: 'alice', password: 'secret', title: 't' })
    assert.deepEqual(target, { type: 'ssh', host: 'server1', port: 22, username: 'alice', title: 't' })
    const res = await registry.callWidgetFunc('vault', 'getCredentials', target)
    assert.deepEqual(res, { pick: { login: 'alice', password: 'pw-server1' } })
    assert.deepEqual(utils.credentialTarget({ type: 'rdp', host: 'h' }).type, 'rdp')
    // ftp keeps the user name in `user`
    assert.equal(utils.credentialTarget({ type: 'ftp', host: 'h', user: 'ftpuser' }).username, 'ftpuser')
  })

  test('connection options: ftp wants `user`, the rest `username`', () => {
    const creds = { username: 'alice', password: 'pw' }
    assert.deepEqual(utils.credentialOptions(creds, 'ssh'), { username: 'alice', password: 'pw' })
    assert.deepEqual(utils.credentialOptions(creds, 'ftp'), { username: 'alice', password: 'pw', user: 'alice' })
    assert.deepEqual(utils.credentialOptions({ password: 'pw' }, 'ssh'), { password: 'pw' })
    assert.deepEqual(utils.credentialOptions(null, 'ssh'), {})
    assert.deepEqual(utils.credentialOptions({ username: 'a' }, 'ssh'), {})
  })

  test('typed answers: a hidden password, a user name, nothing else', () => {
    const ask = (name, prompt, echo) => ({ name, prompts: [{ prompt, echo }] })
    assert.deepEqual(utils.promptAnswer(ask('', 'Password:', false), ['pw']), { password: 'pw' })
    assert.deepEqual(utils.promptAnswer(ask('Username', 'user', true), ['alice']), { username: 'alice' })
    assert.equal(utils.promptAnswer(ask('', 'Password:', true), ['pw']), null)
    assert.equal(utils.promptAnswer(ask('', 'Verification code:', false), ['123']), null)
    assert.equal(utils.promptAnswer({ mode: 'confirm', prompts: [{ prompt: 'Password' }] }, ['x']), null)
    assert.equal(utils.promptAnswer(ask('', 'Password:', false), ['']), null)
  })
})
