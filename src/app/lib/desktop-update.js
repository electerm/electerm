const { app, BrowserWindow, dialog } = require('electron')
const { fork } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')
const installSrc = require('./install-src')
const { getCommandTarget } = require('./install-command')
const compareVersions = require('../common/version-compare')
const normalizeReleaseTag = require('../common/normalize-release-tag.cjs')
const globalState = require('./glob-state')
const { launch, locale } = require('@electerm/updater')

let active

async function startDesktopUpdate ({ tag: requestedTag, mirror, proxy, language }) {
  const messages = locale(language)
  if (active) throw new Error(messages.busy)
  const testing = !!process.env.NODE_TEST
  const downloadOnly = !app.isPackaged || testing
  const tag = normalizeReleaseTag(requestedTag)
  if (!tag) throw new Error(messages.invalid)
  if (!downloadOnly && compareVersions(tag, app.getVersion()) <= 0) {
    throw new Error(messages.newer)
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-update-'))
  const job = {}
  active = job
  let handedOff = false
  try {
    const win = new BrowserWindow({
      width: 400,
      height: 184,
      useContentSize: true,
      resizable: false,
      maximizable: false,
      autoHideMenuBar: true,
      show: false,
      title: messages.title,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(__dirname, '../preload/desktop-update.js')
      }
    })
    job.win = win
    win.setMenu(null)
    win.on('closed', () => {
      if (active === job) cancelDesktopUpdate()
    })
    function display (status, percent) {
      if (win.isDestroyed()) return
      win.setProgressBar(percent === undefined ? 2 : percent / 100)
      win.webContents.send('desktop-update-progress', {
        tag, status, percent, title: messages.title, cancel: messages.cancel, language: messages.language
      })
    }
    await win.loadFile(path.join(__dirname, 'desktop-update.html'))
    if (job.cancelled) return false
    display(messages.check)
    win.show()
    const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1', NODE_USE_SYSTEM_CA: '1' }
    const { needsExport } = require('../server/child-process')
    if (!env.NODE_EXTRA_CA_CERTS && needsExport({ platform: process.platform, nodeVersion: process.versions.node })) {
      const roots = require('./system-ca')()
      if (roots) {
        env.NODE_EXTRA_CA_CERTS = path.join(dir, 'system-ca.pem')
        fs.writeFileSync(env.NODE_EXTRA_CA_CERTS, roots)
      }
    }
    const worker = fork(require.resolve('./desktop-update-worker'), [], {
      cwd: dir,
      execArgv: [],
      env,
      stdio: ['ignore', 'ignore', 'inherit', 'ipc']
    })
    job.worker = worker
    const exe = getCommandTarget({ platform: process.platform, execPath: app.getPath('exe') })
    const plan = await new Promise((resolve, reject) => {
      let downloadStatus = messages.download
      let result
      let error
      worker.on('message', m => {
        if (m.probing) display(messages.mirrors)
        if (m.mirror) {
          downloadStatus = messages.download + ' (' + m.mirror + ')'
          display(downloadStatus)
        }
        if (m.percent !== undefined) display(downloadStatus, m.percent)
        if (m.preparing) display(messages.prepare)
        if (m.error) error = new Error(messages.failed + ' — ' + m.error)
        if (m.plan) result = m.plan
      })
      worker.once('error', reject)
      worker.once('exit', () => {
        if (job.cancelled) resolve(null)
        else if (result) resolve(result)
        else reject(error || new Error(messages.failed))
      })
      worker.send({
        dir,
        options: { src: installSrc, tag, mirror, proxy, language: messages.language, exe, appImage: process.env.APPIMAGE, downloadOnly }
      })
    })
    if (!plan || job.cancelled) return false
    if (downloadOnly) {
      if (!testing) {
        display(messages.verified, 100)
        await dialog.showMessageBox(win, {
          type: 'info',
          message: messages.verified + ' — Electerm ' + tag,
          detail: messages.dev
        })
      }
      return true
    }
    display(messages.ready, 100)
    const { response } = await dialog.showMessageBox(win, {
      type: 'question',
      buttons: [messages.install, messages.cancel],
      cancelId: 1,
      defaultId: 1,
      message: messages.ready + ' — Electerm ' + tag,
      detail: messages.confirm.replace('{tag}', tag)
    })
    if (response !== 0 || job.cancelled) return false
    await launch(plan, process.pid)
    handedOff = true
    globalState.set('closeAction', '')
    app.quit()
    return true
  } finally {
    active = null
    if (job.win && !job.win.isDestroyed()) job.win.destroy()
    if (!handedOff) await fs.promises.rm(dir, { recursive: true, force: true, maxRetries: 3 })
  }
}

function cancelDesktopUpdate () {
  if (!active) return
  active.cancelled = true
  if (active.worker?.connected) active.worker.send({ cancel: true }, () => {})
}

module.exports = { startDesktopUpdate, cancelDesktopUpdate }
