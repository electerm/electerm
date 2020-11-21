/**
 * basic css import
 */

import '../css/basic.styl'

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
  loadScript()
  document.body.removeChild(document.getElementById('content-loading'))
}

// window.addEventListener('load', load)
load()
