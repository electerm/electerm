const defaultSettings = require('./default-setting')

module.exports = exports.default = {
  keepaliveInterval: 0,
  rightClickSelectsWord: false,
  pasteWhenContextMenu: false,
  ctrlOrMetaOpenTerminalLink: false,
  ...defaultSettings,
  terminalTimeout: 5000,
  enableGlobalProxy: false,
  zoom: 1,
  debug: false,
  theme: 'default',
  syncSetting: {
    lastUpdateTime: Date.now(),
    autoSync: false
  },

  host: '127.0.0.1'
}
