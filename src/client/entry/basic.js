/**
 * init app data then write main script to html body
 */
import '../css/basic.styl'
import { get as _get } from 'lodash-es'
import '../common/pre'

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
  window.capitalizeFirstLetter = (string) => {
    return string.charAt(0).toUpperCase() + string.slice(1)
  }
  function loadScript () {
    const rcs = document.createElement('script')
    rcs.src = 'js/electerm.js?' + window.pre.packInfo.version
    rcs.type = 'module'
    document.body.appendChild(rcs)
  }
  window.getLang = (lang = window.store?.config.language || 'en_us') => {
    return _get(window.langMap, `[${lang}].lang`)
  }
  window.prefix = prefix => {
    return (id) => {
      const lang = window.getLang()
      const str = _get(lang, `[${prefix}][${id}]`) || id
      return window.capitalizeFirstLetter(str)
    }
  }
  await loadWorker()
  loadScript()
  document.body.removeChild(document.getElementById('content-loading'))
}

// window.addEventListener('load', load)
load()
