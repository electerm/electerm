/**
 * The script every custom widget UI gets: window.electerm.
 *
 * Served by the electerm-widget:// protocol and injected into the widget's
 * html, so a widget author writes a normal web page and calls the host through
 * this object. Everything crossing the boundary is JSON-serialisable and the
 * host answers over postMessage (the widget document is its own origin, so it
 * cannot touch the app's window).
 *
 * Kept as a plain string (ES5, no imports) because it is shipped as-is to a
 * document the bundler never sees.
 */

const bridgeSource = `(function () {
  if (window.electerm) {
    return
  }
  var pending = {}
  var seq = 0
  var readyResolve
  var ready = new Promise(function (resolve) {
    readyResolve = resolve
  })

  function request (method, args) {
    return new Promise(function (resolve, reject) {
      var reqId = ++seq
      pending[reqId] = { resolve: resolve, reject: reject }
      parent.postMessage({
        __electermWidget: true,
        reqId: reqId,
        method: method,
        args: args || []
      }, '*')
    })
  }

  function applyInit (init) {
    if (!init) {
      return
    }
    var vars = init.cssVars || {}
    Object.keys(vars).forEach(function (name) {
      document.documentElement.style.setProperty(name, vars[name])
    })
    if (init.colorScheme) {
      document.documentElement.style.colorScheme = init.colorScheme
    }
    readyResolve(init)
  }

  window.addEventListener('message', function (evt) {
    var data = evt.data
    if (!data || data.__electermWidgetHost !== true) {
      return
    }
    if (data.method === 'init') {
      applyInit(data.data)
      return
    }
    var item = pending[data.reqId]
    if (!item) {
      return
    }
    delete pending[data.reqId]
    if (data.ok) {
      item.resolve(data.result)
    } else {
      item.reject(new Error(data.error || 'electerm widget call failed'))
    }
  })

  window.electerm = {
    // the protocol host is the widget id: electerm-widget://<id>/<ui>
    id: location.host,
    ready: ready,
    // call a function exported by the widget's main-process module
    call: function (name) {
      var args = Array.prototype.slice.call(arguments, 1)
      return request('call', [name].concat(args))
    },
    getConfig: function () {
      return request('getConfig')
    },
    updateConfig: function (patch) {
      return request('updateConfig', [patch])
    },
    openDialog: function (opts) {
      return request('openDialog', [opts])
    },
    saveDialog: function (opts) {
      return request('saveDialog', [opts])
    },
    copy: function (text) {
      return request('copy', [text])
    },
    openExternal: function (url) {
      return request('openExternal', [url])
    },
    openTab: function (tab) {
      return request('openTab', [tab])
    },
    log: function () {
      return request('log', Array.prototype.slice.call(arguments))
    }
  }
})()
`

module.exports = bridgeSource
