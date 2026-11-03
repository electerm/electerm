const { describe, test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

// Password manager widgets: `electerm.credentialProvider` in package.json,
// listed with the widget, called through callWidgetFunc.

let tmp
let registry
let userWidget
let providerOf
let credentialTarget
let promptAnswer

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
  const utils = await import('../../client/common/credential-provider-utils.js')
  providerOf = utils.providerOf
  credentialTarget = utils.credentialTarget
  promptAnswer = utils.promptAnswer
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

  test('the first usable provider is picked from the widget list', () => {
    const provider = providerOf(registry.listWidgets())
    assert.deepEqual(provider, { id: 'vault', name: 'Vault', get: 'getCredentials', save: 'saveCredentials' })
    assert.equal(providerOf([{ id: 'x', state: 'error', info: { credentialProvider: { get: 'g' } } }]), null)
    assert.equal(providerOf(undefined), null)
    assert.deepEqual(providerOf([{ id: 'y', state: 'ok', info: { credentialProvider: { get: 'g' } } }]), { id: 'y', name: 'y', get: 'g', save: '' })
  })

  test('get is called with the target, never a password', async () => {
    const target = credentialTarget({ host: 'server1', port: 22, username: 'alice', password: 'secret', title: 't' })
    assert.deepEqual(target, { type: 'ssh', host: 'server1', port: 22, username: 'alice', title: 't' })
    const res = await registry.callWidgetFunc('vault', 'getCredentials', target)
    assert.deepEqual(res, { pick: { login: 'alice', password: 'pw-server1' } })
    assert.deepEqual(credentialTarget({ type: 'rdp', host: 'h' }).type, 'rdp')
  })

  test('typed answers: a hidden password, a user name, nothing else', () => {
    const ask = (name, prompt, echo) => ({ name, prompts: [{ prompt, echo }] })
    assert.deepEqual(promptAnswer(ask('', 'Password:', false), ['pw']), { password: 'pw' })
    assert.deepEqual(promptAnswer(ask('Username', 'user', true), ['alice']), { username: 'alice' })
    assert.equal(promptAnswer(ask('', 'Password:', true), ['pw']), null)
    assert.equal(promptAnswer(ask('', 'Verification code:', false), ['123']), null)
    assert.equal(promptAnswer({ mode: 'confirm', prompts: [{ prompt: 'Password' }] }, ['x']), null)
    assert.equal(promptAnswer(ask('', 'Password:', false), ['']), null)
  })
})
