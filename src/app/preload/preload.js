/**
 * preload
 */

const { ipcRenderer, contextBridge, webFrame, webUtils } = require('electron')

contextBridge.exposeInMainWorld(
  'api', {
    getZoomFactor: () => webFrame.getZoomFactor(),
    setZoomFactor: (nl) => webFrame.setZoomFactor(nl),
    getPathForFile: (file) => {
      try {
        return webUtils.getPathForFile(file)
      } catch (error) {
        console.warn('webUtils.getPathForFile failed:', error)
        return null
      }
    },
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
