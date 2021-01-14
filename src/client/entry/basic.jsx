/**
 * init app data then write main script to html body
 */
import '../css/basic.styl'

async function loadWorker () {
  return new Promise((resolve) => {
    window.worker = new window.Worker('js/worker.js')
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
  function capitalizeFirstLetter (string) {
    return string.charAt(0).toUpperCase() + string.slice(1)
  }
  function loadScript () {
    const rcs = document.createElement('script')
    rcs.src = 'js/electerm.js?' + window.pre.packInfo.version
    document.body.appendChild(rcs)
  }
  const globs = await window.pre.runGlobalAsync('init')
  window.langs = globs.langs
  window.lang = globs.lang
  window._config = globs._config
  window.pre.installSrc = globs.installSrc
  window.pre.appPath = globs.appPath
  window.pre.sshConfigItems = globs.sshConfigItems
  window.prefix = prefix => {
    if (window._config.language === 'en_us') {
      return (id) => {
        return capitalizeFirstLetter(window.lang[prefix][id] || id)
      }
    }
    return (id) => {
      return window.lang[prefix][id] || id
    }
  }
  await loadWorker()
  loadScript()
  document.body.removeChild(document.getElementById('content-loading'))
}

// window.addEventListener('load', load)
load()
