/**
 * default setting
 */

module.exports = exports.default = {
  hotkey: 'Control+2',
  sshReadyTimeout: 50000,
  scrollback: 3000,
  onStartSessions: [],
  fontSize: 16,
  fontFamily: 'mono, courier-new, courier, monospace',
  execWindows: 'System32/WindowsPowerShell/v1.0/powershell.exe',
  execMac: 'zsh',
  execLinux: 'bash',
  execWindowsArgs: [],
  execMacArgs: [],
  execLinuxArgs: [],
  enableGlobalProxy: false,
  disableSshHistory: false,
  disableTransferHistory: false,
  terminalBackgroundImagePath: '',
  terminalBackgroundFilterOpacity: 1,
  terminalBackgroundFilterBlur: 1,
  terminalBackgroundFilterBrightness: 1,
  terminalBackgroundFilterGrayscale: 0,
  terminalBackgroundFilterContrast: 1,
  rendererType: 'canvas',
  terminalType: 'xterm-256color',
  keepaliveCountMax: 10,
  saveTerminalLogToFile: false,
  checkUpdateOnStart: true,
  cursorBlink: false,
  cursorStyle: 'block',
  useSystemTitleBar: false,
  opacity: 1,
  defaultEditor: '',
  confirmBeforeExit: false,
  initDefaultTabOnStart: true
}
