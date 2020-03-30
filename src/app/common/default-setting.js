/**
 * default setting
 */

module.exports = exports.default = {
  hotkey: 'Control+2',
  sshReadyTimeout: 50000,
  scrollback: 3000,
  fontSize: 16,
  fontFamily: 'mono, courier-new, courier, monospace',
  execWindows: 'System32/WindowsPowerShell/v1.0/powershell.exe',
  execMac: 'bash',
  execLinux: 'bash',
  enableGlobalProxy: false,
  disableSshHistory: false,
  disableTransferHistory: false,
  terminalBackgroundImagePath: '',
  rendererType: 'canvas',
  terminalType: 'xterm-256color',
  keepaliveCountMax: 10,
  saveTerminalLogToFile: false
}
