/**
 * load data from db
 */

import { dbNames, getData, fetchInitData } from '../common/db'
import deepCopy from 'json-deep-copy'
import parseInt10 from '../common/parse-int10'
import { infoTabs, statusMap, defaultEnvLang } from '../common/constants'
import generate from '../common/id-with-stamp'
import { refsStatic } from '../components/common/ref'
import defaultSettings from '../common/default-setting'
import encodes from '../components/bookmark-form/common/encodes'
import { initWsCommon } from '../common/fetch-from-server'
import safeParse from '../common/parse-json-safe'
import initWatch from './watch'
import { parseQuickConnect } from '../common/parse-quick-connect'
import message from '../components/common/message'
import fs from '../common/fs'
import { parseVv, describeVv } from '../common/parse-vv'
import { vvToTab } from '../common/vv-to-tab'

function getHost (argv, opts) {
  const arr = argv
  let i = arr.length - 1
  const reg = /^(?:([\w\d-_]+)@)?([\w\d-_]+\.[\w\d-_.]+)(?::([\d]+))?$/
  for (; i >= 0; i--) {
    const str = arr[i]
    const mt = str.match(reg)
    if (mt) {
      const port = mt[3]
      const user = mt[1]
      return {
        host: mt[2],
        username: user,
        port: port ? parseInt10(port) : 22
      }
    }
  }
  return {}
}

/**
 * Open a .vv (virt-viewer) connection file as a new Spice session.
 *
 * Used when electerm is handed a file from outside:
 *   electerm /path/to/console.vv
 *
 * This opens a session, it does not import a bookmark. For a Proxmox file that
 * is the only shape that can work at all: the signed proxy ticket it carries is
 * refused by the node's :3128 daemon once it is more than about 40 seconds old,
 * so a bookmark saved from one could never connect.
 *
 * The parse itself is shared with the bookmark form's "Load .vv file" button --
 * src/client/common/parse-vv.js is the single implementation.
 *
 * @param {Object} store
 * @param {string} filePath - absolute path, resolved in the main process
 * @returns {Promise<Object|null>} the parse result, or null on failure
 */
export async function openVvFile (store, filePath) {
  console.debug('opening .vv file', filePath)
  let text
  try {
    // fs.readFile resolves the file as a utf8 string (src/app/lib/fs.js)
    text = await fs.readFile(filePath)
  } catch (err) {
    message.error('cannot read ' + filePath + ': ' + err.message)
    return null
  }
  const parsed = parseVv(text)
  if (!parsed.ok) {
    message.error(describeVv(parsed) + ' (' + filePath + ')')
    return null
  }
  const tab = vvToTab(parsed, { filePath })
  console.debug('.vv file -> tab', tab)
  // A file that did not come from a person clicking through a form gets no
  // chance to read a hint, so anything dropped from it has to be said out loud.
  if (parsed.warnings.length) {
    console.debug('.vv warnings', parsed.warnings)
  }
  if (parsed.ignored.length) {
    message.warning(
      parsed.ignored.length + ' option(s) in this .vv were skipped: ' +
        parsed.ignored.map(d => d.key).join(', ')
    )
  }
  store.ipcOpenTab(tab)
  return parsed
}

export async function addTabFromCommandLine (store, opts) {
  console.debug('command line params', opts)
  if (!opts) {
    return false
  }
  const {
    isHelp,
    helpInfo,
    options,
    argv
  } = opts
  if (helpInfo) {
    store.commandLineHelp = helpInfo
  }
  if (isHelp) {
    return store.openAbout(infoTabs.cmd)
  }
  // A .vv connection file, e.g. `electerm /path/to/console.vv`.
  // Checked before the protocol-URL scan below because the two cannot overlap:
  // a path ending in .vv never matches a `scheme://` prefix.
  if (opts.vvFile) {
    return openVvFile(store, opts.vvFile)
  }
  // Check if argv contains a protocol URL (e.g., ssh://user@host)
  // and use parseQuickConnect for proper parsing
  if (argv && argv.length) {
    const protocolUrl = argv.find(arg =>
      /^(ssh|telnet|rdp|vnc|serial|spice|ftp|http|https|electerm):\/\//i.test(arg)
    )
    if (protocolUrl) {
      const parsed = parseQuickConnect(protocolUrl)
      if (parsed) {
        return store.ipcOpenTab(parsed)
      }
    }
  }

  const conf = getHost(argv, options)
  const update = {
    passphrase: options.passphrase,
    password: options.password,
    // port: options.port ? parseInt(options.port, 10) : 22,
    type: 'ssh',
    status: statusMap.processing,
    id: generate(),
    encode: encodes[0],
    envLang: defaultEnvLang,
    enableSsh: !options.sftpOnly,
    authType: 'password',
    pane: options.type || 'terminal',
    term: defaultSettings.terminalType,
    startDirectoryLocal: options.initFolder
  }
  if (options.setEnv) {
    update.setEnv = options.setEnv
  }
  if (options.title) {
    update.title = options.title
  }
  if (options.user) {
    update.username = options.user
  }
  if (options.port && parseInt10(options.port)) {
    update.port = parseInt10(options.port)
  }
  if (options.opts) {
    const opts = safeParse(options.opts)
    if (opts !== options.opts) {
      Object.assign(update, opts)
      update.fromCmdLine = true
    }
  }
  if (options.tp) {
    update.type = options.tp
    update.fromCmdLine = true
  }
  Object.assign(conf, update)
  if (options.privateKeyPath) {
    conf.privateKey = await window.fs.readFile(options.privateKeyPath)
  }
  console.debug('command line opts', conf)
  if (
    (conf.username && conf.host) ||
    conf.fromCmdLine
  ) {
    store.ipcOpenTab(conf)
  } else {
    // getHost didn't find a match, try parseQuickConnect for shortcut formats
    // that getHost doesn't support (e.g., user:password@host)
    let parsedFallback = null
    if (argv && argv.length) {
      for (const arg of argv) {
        if (/^-/.test(arg)) continue
        const result = parseQuickConnect(arg)
        if (result && result.host) {
          parsedFallback = result
          break
        }
      }
    }
    if (parsedFallback) {
      // Apply command-line options on top of parsed result
      if (options.password) parsedFallback.password = options.password
      if (options.passphrase) parsedFallback.passphrase = options.passphrase
      if (options.user) parsedFallback.username = options.user
      if (options.port && parseInt10(options.port)) parsedFallback.port = parseInt10(options.port)
      if (options.title) parsedFallback.title = options.title
      if (options.setEnv) parsedFallback.setEnv = options.setEnv
      if (options.sftpOnly) parsedFallback.enableSsh = false
      if (options.initFolder) parsedFallback.startDirectoryLocal = options.initFolder
      if (options.opts) {
        const optsParsed = safeParse(options.opts)
        if (optsParsed !== options.opts) {
          Object.assign(parsedFallback, optsParsed)
          parsedFallback.fromCmdLine = true
        }
      }
      if (options.tp) {
        parsedFallback.type = options.tp
        parsedFallback.fromCmdLine = true
      }
      if (options.privateKeyPath) {
        parsedFallback.privateKey = await window.fs.readFile(options.privateKeyPath)
      }
      store.ipcOpenTab(parsedFallback)
    } else if (
      options.initFolder &&
      !(store.config.onStartSessions || []).length &&
      store.config.initDefaultTabOnStart
    ) {
      window.initFolder = options.initFolder
    }
  }
  if (options.batchOp) {
    refsStatic.get('batch-op-runner')?.runBatchOpFromFile(options.batchOp)
  }
}

export default (Store) => {
  Store.prototype.openInitSessions = function () {
    const { store } = window
    const onStartSessions = store.config.onStartSessions

    // If onStartSessions is a string, it's a workspace ID
    if (typeof onStartSessions === 'string' && onStartSessions) {
      store.loadWorkspace(onStartSessions)
    } else {
      // Otherwise, it's an array of bookmark IDs
      const arr = Array.isArray(onStartSessions) ? onStartSessions : []
      for (const s of arr) {
        store.onSelectBookmark(s)
      }
      if (!arr.length && store.config.initDefaultTabOnStart) {
        store.initFirstTab()
      }
    }

    store.confirmLoad()
    const { initTime, loadTime } = window.pre.runSync('getLoadTime')
    if (loadTime) {
      store.loadTime = loadTime
    } else {
      const finishLoadTime = Date.now()
      store.loadTime = finishLoadTime - initTime
      window.pre.runSync('setLoadTime', store.loadTime)
    }
  }
  Store.prototype.fetchSshConfigItems = async function () {
    const arr = await window.pre.runGlobalAsync('loadSshConfig')
      .catch((err) => {
        console.log('fetchSshConfigItems error', err)
        return []
      })
    window.store.sshConfigs = arr
    return arr
  }
  Store.prototype.confirmLoad = function () {
    window.store.configLoaded = true
  }
  Store.prototype.initApp = async function () {
    const { store } = window
    const globs = window.et.globs || await window.pre.runGlobalAsync('init')
    window.langMap = globs.langMap
    store.installSrc = globs.installSrc
    store.appPath = globs.appPath
    store.exePath = globs.exePath
    store.isPortable = globs.isPortable
    store._config = globs.config
    window.et.langs = globs.langs
    store.zoom(store.config.zoom, false, true)
    await initWsCommon()
  }
  Store.prototype.initData = async function () {
    const { store } = window
    store.initLoadingData = true
    try {
      await store.initApp()
      const ext = {}
      const all = dbNames.map(async name => {
        const data = await fetchInitData(name)
        return {
          name,
          data
        }
      })
      await Promise.all(all)
        .then(arr => {
          for (const { name, data } of arr) {
            const dt = JSON.parse(data || '[]')
            // seed the watcher snapshot with a *copy* - manate wraps the exact
            // array assigned into the store, so seeding with `dt` itself would
            // alias snapshot and store to one backing array; the watcher's
            // no-change early-return would then skip DB writes forever
            refsStatic.add('oldState-' + name, deepCopy(dt))
            if (name === 'bookmarks') {
              ext.bookmarksMap = new Map(
                dt.map(d => [d.id, d])
              )
            }
            ext[name] = dt
          }
        })
      ext.lastDataUpdateTime = await getData('lastDataUpdateTime') || 0
      ext.initLoadingData = false
      Object.assign(store, ext)
      store.loadFontList()
      store.fetchItermThemes()
      store.openInitSessions()
      store.fetchSshConfigItems()
      store.initCommandLine().catch(store.onError)
      initWatch(store)
      setTimeout(
        () => {
          store.fixProfiles()
          store.fixBookmarkGroups()
        },
        1000
      )
      setTimeout(
        () => {
          store.autoSyncReady = true
        },
        2000
      )
      if (store.config.checkUpdateOnStart) {
        store.onCheckUpdate(false)
      }
      store.startAutoRunWidgets().catch(err => {
        console.error('Failed to start autorun widgets:', err)
      })
    } catch (err) {
      store.initLoadingData = false
      store.onError(err)
    }
  }
  Store.prototype.initCommandLine = async function () {
    const opts = await window.pre.runGlobalAsync('initCommandLine')
    addTabFromCommandLine(window.store, opts)
  }
  Store.prototype.addTabFromCommandLine = (event, opts) => {
    addTabFromCommandLine(window.store, opts)
  }
  Store.prototype.checkPendingDeepLink = async function () {
    const pending = await window.pre.runGlobalAsync('getPendingDeepLink')
    if (pending) {
      window.store.ipcOpenTab(pending)
    }
  }
  /**
   * A .vv file that arrived before the window existed -- macOS delivers
   * 'open-file' during launch, so a cold double-click always lands here. The
   * payload is the same shape initCommandLine() returns, so it goes through the
   * same entry point as `electerm /path/to/console.vv`.
   */
  Store.prototype.checkPendingVvFile = async function () {
    const pending = await window.pre.runGlobalAsync('getPendingVvFile')
    if (pending) {
      addTabFromCommandLine(window.store, pending)
    }
  }
  Store.prototype.parseQuickConnect = function (url) {
    return parseQuickConnect(url)
  }
}
