/**
 * Passwords from a password manager widget (a credential provider).
 *
 * A user widget names two main-process exports in its package.json:
 *
 *   "electerm": { "credentialProvider": { "get": "getCredentials", "save": "saveCredentials" } }
 *
 * - get({ type, host, port, username, title }) is called before an SSH or RDP
 *   bookmark without a saved password connects, and answers
 *     { pick: { login, password } }               use this one
 *     { pick: 'choose', url, entries, alternatives } let the user choose
 *       (entries / alternatives: [{ uuid, name, login, password }])
 *     { pick: null }                               nothing, ask as usual
 * - save({ target, login, password }) (optional) stores a login after it
 *   worked: for "New entry" right away, else after the user agreed. Answers
 *   { ok, url }.
 *
 * The first installed widget with a provider is used. A bookmark with
 * `credentialProviderIgnore` is left alone. When get fails (password manager
 * not running, locked, ...) the user can retry once it is fixed, or go on
 * without it.
 */

import { Button } from 'antd'
import Modal from '../components/common/modal'
import { notification } from '../components/common/notification'
import {
  providerOf,
  credentialTarget,
  promptAnswer
} from './credential-provider-utils.js'

let cached = null

/**
 * The provider widget, from the widget list.
 * @param {object[]} [widgets] a fresh listWidgets result
 * @return {{id, name, get, save}|null}
 */
export function noteWidgets (widgets) {
  cached = providerOf(widgets)
  // observed, so an open bookmark form shows the switch as soon as it is known
  const name = cached ? cached.name : ''
  if (window.store && window.store.credentialProviderName !== name) {
    window.store.credentialProviderName = name
  }
  return cached
}

// for the bookmark form: shown only with a provider installed
export function hasCredentialProvider () {
  return !!window.store?.credentialProviderName
}

async function currentProvider () {
  try {
    return noteWidgets(await window.store.listWidgets())
  } catch (e) {
    return cached
  }
}

const call = (provider, fn, ...args) => window.pre.runGlobalAsync('callWidgetFunc', provider.id, fn, ...args)

const NEW_ENTRY = 'new'

/**
 * The user's choice: an entry, NEW_ENTRY or null (without the provider).
 */
function chooseEntry (provider, { url, entries = [], alternatives = [] }, target) {
  const where = url || `${target.host}${target.port ? ':' + target.port : ''}`
  return new Promise(resolve => {
    const ref = {}
    const done = v => { ref.modal.destroy(); resolve(v) }
    const list = items => items.map(e => (
      <Button
        key={e.uuid || e.login}
        block
        className='mg1b'
        onClick={() => done(e)}
      >
        {e.login || '(no user name)'}{e.name ? ` · ${e.name}` : ''}
      </Button>
    ))
    // confirm, not info: closing it any way (Esc, cancel) has to settle
    ref.modal = Modal.confirm({
      title: `${provider.name}: ${where}`,
      content: (
        <div className='pd1y'>
          {entries.length ? null : <div className='pd1b'>No entry for {where}</div>}
          {list(entries)}
          {
            alternatives.length
              ? <div className='pd1y'>Other entries for this host:</div>
              : null
          }
          {list(alternatives)}
          {
            provider.save
              ? (
                <Button
                  block
                  type='primary'
                  className='mg1t'
                  onClick={() => done(NEW_ENTRY)}
                >
                  New entry for {where}
                </Button>
                )
              : null
          }
        </div>
      ),
      okText: `Without ${provider.name}`,
      onOk: () => resolve(null),
      onCancel: () => resolve(null)
    })
  })
}

// one retry dialog at a time: tabs connecting together share the answer
let retryAsk = null

/**
 * get failed: retry once the user fixed it (opened or unlocked the password
 * manager), or go on without it
 * @return {Promise<boolean>} true: retry
 */
function askRetry (provider, error) {
  if (!retryAsk) {
    retryAsk = new Promise(resolve => {
      Modal.confirm({
        title: provider.name,
        content: (
          <div className='pd1y'>
            <div>{error}</div>
            <div className='pd1t'>Open or unlock {provider.name}, then retry.</div>
          </div>
        ),
        okText: 'Retry',
        cancelText: `Without ${provider.name}`,
        onOk: () => resolve(true),
        onCancel: () => resolve(false)
      })
    }).finally(() => {
      retryAsk = null
    })
  }
  return retryAsk
}

/**
 * What the provider has for `tab`:
 * - { username, password }: from an entry
 * - { newEntry: true }: the user wants a new entry, see saveToProvider
 * - { declined: true }: the user goes on without it, or the bookmark ignores it
 * - null: no provider
 * get failing asks the user to retry, going on without it is { declined: true }
 */
export async function credentialsFromProvider (tab) {
  if (!tab.host || tab.password) {
    return null
  }
  const provider = await currentProvider()
  if (!provider) {
    return null
  }
  // the bookmark opts out: no lookup, no offer to save
  if (tab.credentialProviderIgnore) {
    return { declined: true }
  }
  const target = credentialTarget(tab)
  let res
  for (;;) {
    res = await call(provider, provider.get, target).catch(e => ({ error: e.message }))
    if (!res?.error) {
      break
    }
    if (!await askRetry(provider, res.error)) {
      return { declined: true }
    }
  }
  if (!res) {
    return null
  }
  const entry = res.pick === 'choose'
    ? await chooseEntry(provider, res, target)
    : res.pick
  if (!entry) {
    return res.pick === 'choose' ? { declined: true } : null
  }
  if (entry === NEW_ENTRY) {
    return { newEntry: true }
  }
  // the entry's user name belongs to its password; the bookmark's only
  // fills in for an entry without one
  return {
    username: entry.login || tab.username,
    password: entry.password
  }
}

// tab id -> { username, password } typed at a prompt, until the tab connected
const typed = new Map()

/**
 * From the prompt dialog: remember a typed user name / password.
 * @param {string} tabId
 * @param {object} options the prompt (session-interactive options)
 * @param {string[]} results the answers
 */
export function rememberTyped (tabId, options, results) {
  if (!cached?.save || !tabId) {
    return
  }
  const answer = promptAnswer(options, results)
  if (answer) {
    typed.set(tabId, { ...typed.get(tabId), ...answer })
  }
}

// the typed credentials of `tab`, null without a password
function typedFor (tab, creds) {
  const t = creds || typed.get(tab.id)
  typed.delete(tab.id)
  if (!cached?.save || !t?.password) {
    return null
  }
  return { login: t.username || tab.username || '', password: t.password }
}

async function save (provider, tab, { login, password }) {
  const res = await call(provider, provider.save, {
    target: credentialTarget(tab),
    login,
    password
  }).catch(e => ({ error: e.message }))
  if (res?.ok) {
    notification.success({ message: provider.name, description: `Saved${res.url ? ' for ' + res.url : ''}`, duration: 4 })
  } else {
    notification.error({ message: provider.name, description: res?.error || 'Not saved' })
  }
}

/**
 * The tab connected after the user asked for a new entry: save the typed
 * user name and password.
 * @param {object} tab
 * @param {object} [creds] credentials typed elsewhere (RDP form)
 */
export function saveToProvider (tab, creds) {
  const provider = cached
  const t = typedFor(tab, creds)
  if (t) {
    save(provider, tab, t)
  }
}

/**
 * The tab connected with a typed password: offer to save it.
 * @param {object} tab
 * @param {object} [creds] credentials typed elsewhere (RDP form)
 */
export function offerSaveToProvider (tab, creds) {
  const provider = cached
  const t = typedFor(tab, creds)
  if (!t || tab.credentialProviderIgnore) {
    return
  }
  const { login } = t
  const key = 'credential-provider-save-' + tab.id
  const onSave = () => {
    notification.destroy(key)
    save(provider, tab, t)
  }
  notification.info({
    key,
    message: provider.name,
    description: (
      <div>
        <div className='pd1b'>Save the password for {login ? `${login}@` : ''}{tab.host} in {provider.name}?</div>
        <Button type='primary' size='small' onClick={onSave}>Save</Button>
      </div>
    ),
    duration: 0
  })
}
