
const defaultSettings = require('./default-setting')

module.exports = exports.default = {
  keepaliveInterval: 10 * 1000,
  rightClickSelectsWord: false,
  pasteWhenContextMenu: false,
  ctrlOrMetaOpenTerminalLink: false,
  showMenu: true,
  ...defaultSettings,
  terminalTimeout: 5000,
  proxyPort: 1080,
  proxyType: '5',
  proxyIp: '127.0.0.1',
  proxyUsername: '',
  proxyPassword: '',
  zoom: 1,
  theme: 'default',
  syncSetting: {
    lastUpdateTime: Date.now(),
    autoSync: false
  },
  terminalTypes: [
    'xterm-256color',
    'xterm-color',
    'vt100',
    'xterm-vt220',
    'xterm',
    'ansi'
  ],
  host: 'localhost'
}
