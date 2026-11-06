/**
 * Passwords from a password manager widget (a credential provider).
 *
 * A user widget names two main-process exports in its package.json:
 *
 *   "electerm": { "credentialProvider": { "get": "getCredentials", "save": "saveCredentials" } }
 *
 * Only a bookmark that opts in is ever passed on: `usePasswordManager` in the
 * bookmark form (ssh, telnet, rdp, vnc, spice, ftp), and only while it has no
 * password of its own. Every other bookmark connects exactly as before.
 *
 * - get({ type, host, port, username, title }) answers
 *     { pick: { login, password } }               use this one
 *     { pick: 'choose', url, entries, alternatives } let the user choose
 *       (entries / alternatives: [{ uuid, name, login, password? }]; a widget
 *       may leave `password` out and answer again for { ...target, uuid })
 *     { pick: null }                               nothing, ask as usual
 * - save({ target, login, password, uuid }) (optional) stores a login that
 *   worked, or updates the entry `uuid` when the provider served it. Answers
 *   { ok, url }.
 *
 * get failing (password manager not running, locked, ...) is reported once and
 * the session goes on as if there were no provider: the user gets the normal
 * prompt, and no dialog holds a connection open.
 */

import { Button } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import Modal from '../components/common/modal'
import { notification } from '../components/common/notification'
import {
  providerOf,
  credentialTarget,
  promptAnswer,
  wantsProvider,
  canCreateEntry
} from './credential-provider-utils.js'

const e = window.translate

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
  } catch (err) {
    return cached
  }
}

const call = (provider, fn, ...args) => window.pre.runGlobalAsync('callWidgetFunc', provider.id, fn, ...args)

const NEW_ENTRY = 'new'

// per tab: the answer used last, so reconnecting a tab does not ask again
const RECENT_TTL = 10 * 60 * 1000
const RECENT_MAX = 20
const recent = new Map()

function remember (tab, creds) {
  if (!tab.id || !creds?.password) {
    return
  }
  recent.set(tab.id, { host: tab.host, at: Date.now(), ...creds })
  if (recent.size > RECENT_MAX) {
    recent.delete(recent.keys().next().value)
  }
}

function recall (tab) {
  const r = tab.id && recent.get(tab.id)
  if (!r) {
    return null
  }
  if (r.host !== tab.host || Date.now() - r.at > RECENT_TTL) {
    recent.delete(tab.id)
    return null
  }
  return r
}

// the same error from tabs connecting together is reported once
let lastError = { text: '', at: 0 }

// the IPC layer wraps a widget's error in its own text ("Error invoking remote
// method 'async': Error: ..."): show the part the widget wrote
function readableError (error) {
  return String(error || '')
    .replace(/^Error invoking remote method '[^']+':\s*/, '')
    .replace(/^Error:\s*/, '')
}

function warn (provider, error) {
  const text = readableError(error)
  const now = Date.now()
  if (text === lastError.text && now - lastError.at < 10000) {
    return
  }
  lastError = { text, at: now }
  notification.error({
    message: provider.name,
    description: text,
    duration: 8
  })
}

/**
 * The user's choice: an entry, NEW_ENTRY or null (connect without it).
 * No text of its own: the widget name and the URL are data, the button an icon.
 */
function chooseEntry (provider, { url, entries = [], alternatives = [] }, target) {
  const where = url || `${target.host}${target.port ? ':' + target.port : ''}`
  return new Promise(resolve => {
    const ref = {}
    const done = v => {
      ref.modal.destroy()
      resolve(v)
    }
    const list = items => items.map(entry => (
      <Button
        key={entry.uuid || entry.login}
        block
        className='mg1b'
        onClick={() => done(entry)}
      >
        {entry.login || target.username || '-'}{entry.name ? ` · ${entry.name}` : ''}
      </Button>
    ))
    // confirm with no cancel button: one footer button (the existing "cancel"
    // key) and Esc/mask still settle the promise, so no connect waits forever
    ref.modal = Modal.confirm({
      title: `${provider.name} · ${where}`,
      content: (
        <div className='pd1y'>
          {list(entries)}
          {alternatives.length ? <hr className='mg1y' /> : null}
          {list(alternatives)}
          {
            provider.save && canCreateEntry(target)
              ? (
                <Button
                  block
                  type='primary'
                  icon={<PlusOutlined />}
                  title={where}
                  className='mg1t'
                  onClick={() => done(NEW_ENTRY)}
                />
                )
              : null
          }
        </div>
      ),
      okText: e('cancel'),
      // no second footer button: the entries in the body are the actions
      cancelText: null,
      onOk: () => resolve(null),
      onCancel: () => resolve(null)
    })
  })
}

/**
 * The entry of a choice, with its password: a chooser entry may come without
 * one, then the provider answers a second call for that uuid.
 * @return {Promise<{username, password, uuid}|null>}
 */
async function entryCredentials (provider, target, entry, tab) {
  let password = entry.password
  if (password === undefined && entry.uuid) {
    const res = await call(provider, provider.get, {
      ...target,
      uuid: entry.uuid
    }).catch(err => ({ error: err.message }))
    if (res?.error) {
      warn(provider, res.error)
      return null
    }
    const pick = res?.pick
    password = pick && typeof pick === 'object' ? pick.password : undefined
  }
  if (!password) {
    return null
  }
  // the entry's user name belongs to its password; the bookmark's only fills
  // in for an entry without one
  const creds = {
    username: entry.login || tab.username,
    password,
    uuid: entry.uuid || ''
  }
  remember(tab, creds)
  return creds
}

/**
 * What the provider has for `tab`:
 * - { username, password, uuid }: from an entry
 * - { newEntry: true }: the user wants a new entry, see saveToProvider
 * - { declined: true }: the user chose to connect without it
 * - null: not asked (no opt-in, no provider, nothing found, provider failed)
 */
export async function credentialsFromProvider (tab) {
  if (!wantsProvider(tab)) {
    return null
  }
  const provider = await currentProvider()
  if (!provider) {
    return null
  }
  const remembered = recall(tab)
  if (remembered) {
    return remembered
  }
  const target = credentialTarget(tab)
  const res = await call(provider, provider.get, target)
    .catch(err => ({ error: err.message }))
  if (res?.error) {
    warn(provider, res.error)
    return null
  }
  if (!res) {
    return null
  }
  const entry = res.pick === 'choose'
    ? await chooseEntry(provider, res, target)
    : res.pick
  if (entry === NEW_ENTRY) {
    return { newEntry: true }
  }
  if (!entry) {
    return res.pick === 'choose' ? { declined: true } : null
  }
  return entryCredentials(provider, target, entry, tab)
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
function takeTyped (tab, creds) {
  const t = creds || typed.get(tab.id)
  typed.delete(tab.id)
  if (!cached?.save || !t?.password) {
    return null
  }
  return { login: t.username || tab.username || '', password: t.password }
}

async function save (provider, tab, { login, password }, uuid) {
  const res = await call(provider, provider.save, {
    target: credentialTarget(tab),
    login,
    password,
    ...(uuid ? { uuid } : {})
  }).catch(err => ({ error: err.message }))
  if (res?.ok) {
    notification.success({
      message: provider.name,
      description: res.url || '',
      duration: 3
    })
  } else {
    notification.error({
      message: provider.name,
      description: res?.error || tab.host
    })
  }
}

/**
 * The user asked for a new entry and the session connected: keep the login.
 * @param {object} tab
 * @param {object} [creds] credentials typed elsewhere (rdp form)
 */
export function saveToProvider (tab, creds) {
  const provider = cached
  const t = takeTyped(tab, creds)
  if (t && provider?.save) {
    save(provider, tab, t)
  }
}

/**
 * The session connected with a typed password: offer to keep it. Also the way
 * to repair an entry the provider served with a password that no longer works:
 * the entry's uuid goes with the save.
 * @param {object} tab
 * @param {object} [creds] credentials typed elsewhere (rdp form)
 */
export function offerSaveToProvider (tab, creds) {
  const provider = cached
  if (!provider?.save) {
    return
  }
  // the bookmark opts in, or the provider served this tab and its entry now
  // holds a password that no longer works: then the save repairs that entry
  const served = recall(tab)
  if (!wantsProvider(tab) && !served) {
    return
  }
  const t = takeTyped(tab, creds)
  if (!t) {
    return
  }
  const { login } = t
  const uuid = served?.uuid || ''
  const key = 'credential-provider-save-' + tab.id
  const onSave = () => {
    notification.destroy(key)
    save(provider, tab, t, uuid)
  }
  notification.info({
    key,
    message: provider.name,
    description: (
      <div>
        <div className='pd1b'>{login ? `${login}@` : ''}{tab.host}</div>
        <Button type='primary' size='small' onClick={onSave}>
          {e('savePassword')}
        </Button>
      </div>
    ),
    duration: 0
  })
}

/**
 * The session is up: keep what the user asked to keep.
 * @param {object} tab
 * @param {{newEntry?, declined?}} [creds] what credentialsFromProvider answered
 * @param {object} [typedCreds] credentials typed in a form (rdp)
 */
export function connectedToProvider (tab, creds, typedCreds) {
  if (creds?.newEntry) {
    saveToProvider(tab, typedCreds)
    return
  }
  if (creds?.declined) {
    return
  }
  offerSaveToProvider(tab, typedCreds)
}
