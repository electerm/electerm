/**
 * default setting
 */

module.exports = exports.default = {
  hotkey: 'Control+2',
  sshReadyTimeout: 50000,
  scrollback: 3000,
  onStartSessions: [],
  fontSize: 16,
  fontFamily: 'Fira Code, mono, courier-new, courier, monospace',
  execWindows: 'System32/WindowsPowerShell/v1.0/powershell.exe',
  execMac: 'zsh',
  execLinux: 'bash',
  execWindowsArgs: [],
  execMacArgs: [],
  execLinuxArgs: [],
  enableGlobalProxy: false,
  disableConnectionHistory: false,
  disableTransferHistory: false,
  terminalBackgroundImagePath: '',
  terminalBackgroundFilterOpacity: 1,
  terminalBackgroundFilterBlur: 0,
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
  useSystemTitleBar: process.platform === 'linux',
  opacity: 1,
  defaultEditor: '',
  terminalWordSeparator: './\\()"\'-:,.;<>~!@#$%^&*|+=[]{}`~ ?',
  confirmBeforeExit: false,
  initDefaultTabOnStart: true,
  screenReaderMode: false,
  autoRefreshWhenSwitchToSftp: false,
  addTimeStampToTermLog: false,
  keepaliveInterval: 0,
  backspaceMode: '^?',
  showHiddenFilesOnSftpStart: true,
  terminalInfos: [
    'uptime',
    'cpu',
    'mem',
    'activities',
    'network',
    'disks'
  ],
  filePropsEnabled: [
    'name',
    'size',
    'modifyTime'
  ],
  hideIP: false,
  dataSyncSelected: 'all',
  baseURLAI: 'https://api.deepseek.com',
  modelAI: 'deepseek-chat',
  roleAI: `You are a terminal command expert.
- Provide clear, safe, and efficient shell commands
- Always explain what each command does
- Warn about potentially dangerous operations
- Format command output with markdown code blocks
- If multiple steps are needed, number them
- Mention any prerequisites or dependencies
- Include common flags and options
- Specify which OS (Linux/Mac/Windows) the command is for`
}
