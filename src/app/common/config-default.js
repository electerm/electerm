
const defaultSettings = require('./default-setting')

module.exports = exports.default = {
  keepaliveInterval: 10 * 1000,
  rightClickSelectsWord: false,
  pasteWhenContextMenu: false,
  ctrlOrMetaOpenTerminalLink: false,
  ...defaultSettings,
  terminalTimeout: 5000,
  enableGlobalProxy: false,
  proxyPort: 1080,
  proxyType: '5',
  proxyIp: '127.0.0.1',
  proxyUsername: '',
  proxyPassword: '',
  zoom: 1,
  debug: false,
  theme: 'default',
  syncSetting: {
    lastUpdateTime: Date.now(),
    autoSync: false
  },
  terminalTypes: [
    'xterm-256color',
    'xterm-new',
    'xterm-color',
    'xterm-vt220',
    'xterm',
    'linux',
    'vt100',
    'ansi',
    'rxvt'
  ],
  host: '127.0.0.1'
}
