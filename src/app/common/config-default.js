const defaultSettings = require('./default-setting')

module.exports = exports.default = {
  keepaliveInterval: 10000,
  rightClickSelectsWord: false,
  // Pass mouse reports to the app only while Alt/Option is held. Lets wheel
  // keep scrolling tmux/vim history while plain drags stay local selections.
  mouseEventsRequireAlt: false,
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
    autoSync: false,
    autoSyncInterval: 0,
    autoSyncDirection: 'upload'
  },
  keyword2FA: 'verification code,otp,one-time,two-factor,2fa,totp,authenticator,duo,yubikey,security code,mfa,passcode',

  host: '127.0.0.1'
}
