/**
 * init app data then write main script to html body
 */
import '../css/basic.styl'
import '../css/mobile.styl'
import '../common/pre'

const { isDev } = window.et
const { version } = window.pre.packInfo

async function loadWorker () {
  return new Promise((resolve) => {
    const url = !isDev ? `js/worker-${version}.js` : 'js/worker.js'
    window.worker = new window.Worker(url)
    function onInit (e) {
      if (!e || !e.data) {
        return false
      }
      const {
        action
      } = e.data
      if (action === 'worker-init') {
        window.worker.removeEventListener('message', onInit)
        resolve(1)
      }
    }
    window.worker.addEventListener('message', onInit)
  })
}

async function load () {
  window.capitalizeFirstLetter = (string) => {
    return string.charAt(0).toUpperCase() + string.slice(1)
  }
  function loadScript () {
    const rcs = document.createElement('script')
    const url = !isDev ? `js/electerm-${version}.js` : 'js/electerm.js'
    rcs.src = url
    rcs.type = 'module'
    rcs.onload = () => {
      const loadingEl = document.getElementById('content-loading')
      if (loadingEl) {
        document.body.removeChild(loadingEl)
      }
    }
    document.body.appendChild(rcs)
  }
  const initLocale = window.pre.runSync('getInitLocale') || {}
  window.langMap = initLocale.langMap
  window.initLanguage = initLocale.language
  // Plain property access instead of lodash `get`: importing lodash-es put six
  // extra chunks in front of this file, and an ES module cannot execute until
  // its imports have arrived -- ~90ms of the startup critical path for two
  // lookups. Keep this module dependency-free so it runs as soon as it lands.
  window.getLang = (lang = window.store?.config.language || window.initLanguage || 'en_us') => {
    return (window.langMap || {})[lang]?.lang
  }
  window.translate = txt => {
    const lang = window.getLang()
    const str = (lang && lang[txt]) || txt
    return window.capitalizeFirstLetter(str)
  }
  // Start the app bundle immediately instead of waiting for the worker's init
  // handshake: the worker is only used once a session opens, and this `await`
  // used to sit between "basic.js ran" and "request the app bundle" (measured:
  // ~130ms of pure serial time). window.worker is assigned synchronously inside
  // loadWorker(), so anything that needs it still finds it.
  const workerReady = loadWorker()
  loadScript()
  await workerReady
}

// window.addEventListener('load', load)
load()
