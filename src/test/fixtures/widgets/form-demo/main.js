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
        { label: 'Echo mode', action: 'echo' },
        { label: 'Offer bookmarks', action: 'offerBookmarks' }
      ]
    }
  },

  // an action result may offer bookmarks for import: electerm lists them and
  // imports only when the user presses the button
  offerBookmarks (config) {
    return {
      bookmarks: [
        {
          id: 'wm1',
          title: 'web-one',
          type: 'ssh',
          host: config.host,
          port: 2222,
          username: 'root',
          password: config.passphrase
        },
        {
          id: 'wm2',
          title: 'telnet-one',
          type: 'telnet',
          host: 'tel.example.com'
        },
        {
          id: 'wm3',
          title: 'web-page',
          type: 'web',
          url: 'https://example.com/admin'
        }
      ],
      bookmarkGroups: [
        {
          id: 'wbg-a',
          name: 'Converted A',
          bookmarkIds: ['wm1', 'wm2'],
          bookmarkGroupIds: []
        },
        {
          id: 'wbg-b',
          name: 'Converted B',
          bookmarkIds: ['wm3'],
          bookmarkGroupIds: []
        }
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
