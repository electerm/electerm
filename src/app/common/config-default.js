const defaultSettings = require('./default-setting')

module.exports = exports.default = {
  keepaliveInterval: 10000,
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
  keyword2FA: 'verification code,otp,one-time,two-factor,2fa,totp,authenticator,duo,yubikey,security code,mfa,passcode',

  host: '127.0.0.1'
}
