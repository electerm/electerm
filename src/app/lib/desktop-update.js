const { app, BrowserWindow, dialog } = require('electron')
const { fork } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')
const installSrc = require('./install-src')
const globalState = require('./glob-state')
const { launch } = require('@electerm/updater')

let active

async function startDesktopUpdate ({ tag, mirror, proxy }) {
  if (active) throw new Error('An update is already running')
  const testing = !!process.env.NODE_TEST
  if (!app.isPackaged && !testing) throw new Error('Update is available in desktop releases')
  if (!/^v\d+\.\d+\.\d+$/.test(tag)) throw new Error('Invalid release version')
  const current = app.getVersion().split('.').map(Number)
  const delta = tag.slice(1).split('.').map((v, i) => Number(v) - current[i]).find(n => n !== 0)
  if (!testing && !(delta > 0)) throw new Error('Select a newer Electerm release')
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
      title: 'Electerm update',
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
      win.webContents.send('desktop-update-progress', { tag, status, percent })
    }
    await win.loadFile(path.join(__dirname, 'desktop-update.html'))
    if (job.cancelled) return false
    display('Checking release…')
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
    const plan = await new Promise((resolve, reject) => {
      let result
      let error
      worker.on('message', m => {
        if (m.percent !== undefined) display('Downloading…', m.percent)
        if (m.preparing) display('Preparing verified update…')
        if (m.error) error = new Error(m.error)
        if (m.plan) result = m.plan
      })
      worker.once('error', reject)
      worker.once('exit', () => {
        if (job.cancelled) resolve(null)
        else if (result) resolve(result)
        else reject(error || new Error('Updater exited before preparing the update'))
      })
      worker.send({
        dir,
        options: { src: installSrc, tag, mirror, proxy, exe: app.getPath('exe'), appImage: process.env.APPIMAGE, testing }
      })
    })
    if (!plan || job.cancelled) return false
    if (testing) return true
    display('Ready to install', 100)
    const { response } = await dialog.showMessageBox(win, {
      type: 'question',
      buttons: ['Close Electerm and install', 'Cancel'],
      cancelId: 1,
      defaultId: 1,
      message: 'Install Electerm ' + tag + '?',
      detail: 'The download is verified. Installing will close all Electerm sessions.'
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
