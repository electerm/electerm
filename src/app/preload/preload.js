/**
 * preload
 */

const { ipcRenderer, contextBridge, webFrame } = require('electron')

contextBridge.exposeInMainWorld(
  'api', {
    getZoomFactor: () => webFrame.getZoomFactor(),
    setZoomFactor: (nl) => webFrame.setZoomFactor(nl),
    openDialog: (opts) => {
      return ipcRenderer.invoke('show-open-dialog-sync', opts)
    },
    ipcOnEvent: (event, cb) => {
      ipcRenderer.on(event, cb)
    },
    ipcOffEvent: (event, cb) => {
      ipcRenderer.removeListener(event, cb)
    },
    runGlobalAsync: (name, ...args) => {
      return ipcRenderer.invoke('async', {
        name,
        args
      })
    },
    runSync: (name, ...args) => {
      return ipcRenderer.sendSync('sync-func', {
        name,
        args
      })
    }
  }
)
