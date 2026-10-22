/* eslint-env node */

// A config-mode widget: electerm draws the form from package.json and calls
// these exports. No HTML, no bridge, no renderer code in the widget.
module.exports = {
  run (config) {
    return {
      message: `Searched ${config.host}`,
      messageType: 'success',
      details: [
        { label: 'Host', value: config.host, copy: true },
        { label: 'Passphrase', value: config.passphrase, secret: true },
        { label: 'Port', value: String(config.port) }
      ],
      table: {
        columns: [
          { key: 'name', title: 'Name' },
          { key: 'username', title: 'Username' }
        ],
        rows: [
          { id: 'r1', name: 'Root', username: 'root' }
        ],
        rowButtons: [
          { label: 'Open', action: 'openRow' }
        ]
      },
      buttons: [
        { label: 'Echo mode', action: 'echo' }
      ]
    }
  },

  openRow (row, config) {
    return {
      message: `open ${row.username}`,
      openTab: {
        type: 'ssh',
        host: config.host,
        port: config.port,
        username: row.username,
        password: config.passphrase,
        authType: 'password'
      }
    }
  },

  echo (config) {
    return {
      message: `mode ${config.mode}`,
      messageType: 'info'
    }
  }
}
