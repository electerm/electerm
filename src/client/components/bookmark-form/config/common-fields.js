/**
 * Common field definitions shared across multiple configs
 * Reduces duplication and ensures consistency
 */
import { terminalTypes } from '../../../common/constants'
import defaultSettings from '../../../common/default-setting'
import encodes from '../common/encodes'
import { buildFontFamilyOptions } from '../../../common/google-fonts'
import { isEmpty } from 'lodash-es'

const e = window.translate

const commonLangOptions = [
  'zh_CN.GBK',
  'C',
  'POSIX',
  'C.UTF-8',
  'en_US.UTF-8',
  'en_US',
  'en_GB.UTF-8',
  'fr_FR.UTF-8',
  'de_DE.UTF-8',
  'es_ES.UTF-8',
  'it_IT.UTF-8',
  'pt_BR.UTF-8',
  'pt_PT.UTF-8',
  'zh_CN.UTF-8',
  'zh_CN.GB2312',
  'zh_TW.UTF-8',
  'zh_HK.UTF-8',
  'zh_SG.UTF-8',
  'ja_JP.UTF-8',
  'ja_JP.eucJP',
  'ko_KR.UTF-8',
  'ru_RU.UTF-8',
  'ar_SA.UTF-8'
].map(l => ({ label: l, value: l }))

// Common individual fields
export const commonFields = {
  // Basic connection fields
  host: {
    type: 'colorTitle',
    name: 'host',
    label: () => e('host'),
    rules: [{ required: true, message: e('host') + ' required' }]
  },

  colorTitle: {
    type: 'colorTitle',
    name: 'title',
    label: () => e('title')
  },

  title: {
    type: 'input',
    name: 'title',
    label: () => e('title')
  },

  username: {
    type: 'input',
    name: 'username',
    label: () => e('username')
  },

  password: {
    type: 'password',
    name: 'password',
    label: () => e('password')
  },

  loginPrompt: {
    type: 'input',
    name: 'loginPrompt',
    label: () => e('loginPrompt'),
    props: { placeholder: '/login[: ]*$/i' }
  },

  passwordPrompt: {
    type: 'input',
    name: 'passwordPrompt',
    label: () => e('passwordPrompt'),
    props: { placeholder: '/password[: ]*$/i' }
  },

  port: {
    type: 'number',
    name: 'port',
    label: () => e('port'),
    rules: [{ required: true, message: 'port required' }]
  },

  description: {
    type: 'textarea',
    name: 'description',
    label: () => e('description')
  },

  category: {
    type: 'categorySelect',
    name: 'category',
    label: () => e('category')
  },

  type: {
    type: 'input',
    name: 'type',
    label: 'type',
    hidden: true
  },

  // SSH/Terminal specific fields
  setEnv: {
    type: 'input',
    name: 'setEnv',
    label: 'SetEnv',
    props: { placeholder: 'SEC=xxx BEC=xxxx' }
  },

  startDirectoryLocal: {
    type: 'input',
    name: 'startDirectoryLocal',
    label: `${e('startDirectory')}:${e('local')}`
  },

  startDirectory: {
    type: 'input',
    name: 'startDirectory',
    label: `${e('startDirectory')}:${e('remote')}`
  },

  interactiveValues: {
    type: 'textarea',
    name: 'interactiveValues',
    label: () => e('interactiveValues')
  },

  encode: {
    type: 'select',
    name: 'encode',
    label: () => e('encode'),
    options: encodes.map(k => ({ label: k.toUpperCase(), value: k }))
  },

  // Terminal UI settings
  envLang: {
    type: 'autocomplete',
    name: 'envLang',
    label: 'ENV:LANG',
    rules: [{ max: 130, message: '130 chars max' }],
    options: commonLangOptions,
    props: { placeholder: 'en_US.UTF-8' }
  },

  terminalType: {
    type: 'autocomplete',
    name: 'term',
    label: () => e('terminalType'),
    rules: [{ required: true, message: 'terminal type required' }],
    options: terminalTypes.map(t => ({ label: t, value: t }))
  },

  displayRaw: {
    type: 'switch',
    name: 'displayRaw',
    label: () => e('displayRaw'),
    valuePropName: 'checked'
  },

  fontFamily: {
    type: 'autocomplete',
    name: 'fontFamily',
    label: () => e('fontFamily'),
    rules: [{ max: 130, message: '130 chars max' }],
    options: buildFontFamilyOptions,
    props: {
      placeholder: defaultSettings.fontFamily,
      filterOption: (input, option) =>
        (option?.value ?? '').toLowerCase().includes(input.toLowerCase())
    }
  },

  fontSize: {
    type: 'number',
    name: 'fontSize',
    label: () => e('fontSize'),
    props: {
      min: 9,
      max: 65535,
      step: 1,
      placeholder: defaultSettings.fontSize
    }
  },

  keepaliveInterval: {
    type: 'number',
    name: 'keepaliveInterval',
    label: () => e('keepaliveIntervalDesc'),
    props: {
      min: 0,
      max: 20000000,
      step: 1000
    }
  },

  terminalBackground: {
    type: 'terminalBackground',
    name: 'terminalBackground',
    label: () => e('terminalBackgroundImage')
  },

  proxy: {
    type: 'proxy',
    name: '__proxy__',
    label: () => e('proxy')
  },

  x11: {
    type: 'x11',
    name: '__x11__',
    label: 'x11'
  },

  // Dynamic sections
  quickCommands: {
    type: 'quickCommands',
    name: '__quick__',
    label: ''
  },

  sshTunnels: {
    type: 'sshTunnels',
    name: '__tunnels__',
    label: ''
  },

  connectionHopping: {
    type: 'connectionHopping',
    name: '__hopping__',
    label: ''
  },

  runScripts: {
    type: 'runScripts',
    name: 'runScripts',
    label: ''
  },

  enableTerminalImage: {
    type: 'switch',
    name: 'enableTerminalImage',
    label: () => e('enableTerminalImage'),
    valuePropName: 'checked'
  }
}

// Common field groups for settings tabs
export const terminalSettings = [
  commonFields.terminalType,
  commonFields.proxy,
  commonFields.displayRaw,
  commonFields.fontFamily,
  commonFields.fontSize,
  commonFields.keepaliveInterval,
  commonFields.terminalBackground
]

export const sshSettings = [
  { type: 'sectionHeader', title: 'Protocols', description: 'Which channels this bookmark opens' },
  { type: 'toggleRow', name: 'enableSsh', title: 'SSH', description: 'Interactive shell over port 22', badge: true, valuePropName: 'checked' },
  { type: 'toggleRow', name: 'enableSftp', title: 'SFTP', description: 'File transfer pane alongside the terminal', badge: true, valuePropName: 'checked' },

  { type: 'sectionHeader', title: 'Terminal', description: 'How the session renders' },
  { ...commonFields.terminalType, half: true },
  { ...commonFields.proxy, half: true },
  { ...commonFields.keepaliveInterval, half: true },
  commonFields.x11,
  commonFields.terminalBackground,

  { type: 'sectionHeader', title: 'Behavior', description: 'Edge cases and compatibility' },
  { type: 'toggleRow', name: 'ignoreKeyboardInteractive', title: () => e('ignoreKeyboardInteractive'), description: 'Skip challenge-response prompts during auth', valuePropName: 'checked' },
  { type: 'toggleRow', name: 'enableTerminalImage', title: () => e('enableTerminalImage'), description: 'Render inline images with the iTerm2 protocol', valuePropName: 'checked' },
  { type: 'toggleRow', name: 'displayRaw', title: () => e('displayRaw'), description: 'Print escape sequences instead of interpreting them', valuePropName: 'checked' }
]

export const sshUiThemeFields = [
  { type: 'sectionHeader', title: 'Appearance', description: 'Font used for this session' },
  { ...commonFields.fontFamily, half: true },
  { ...commonFields.fontSize, half: true },
  { type: 'bookmarkThemePreview', name: '__themePreview__' },

  { type: 'sectionHeader', title: 'Theme', description: 'Overrides the global UI theme for this bookmark only' },
  { type: 'bookmarkThemePicker', name: 'themeId' }
]

// Common auth fields
export const basicAuthFields = [
  commonFields.host,
  commonFields.username,
  commonFields.password,
  commonFields.port,
  commonFields.category,
  commonFields.title,
  commonFields.description,
  commonFields.type
]

export const sshAuthFields = [
  { type: 'sectionHeader', title: 'Connection', description: 'Where to connect and how to label it' },
  commonFields.title,
  commonFields.category,
  { ...commonFields.host, type: 'sshHostSelector' },
  { ...commonFields.port, half: true },

  { type: 'sectionHeader', title: 'Authentication', description: 'Credentials used for this session' },
  { ...commonFields.username, half: true },
  { type: 'sshAuthTypeSelector', name: 'authType', label: '', half: true, props: { label: 'Method' } },
  { type: 'sshAuthSelector', name: '__auth__', label: '', formItemName: 'password' },
  {
    type: 'sshAgent',
    name: 'useSshAgent'
  },
  { type: 'switch', name: 'isMFA', label: () => e('MFA/OTP'), valuePropName: 'checked' },

  { type: 'sectionHeader', title: 'On connect', description: 'Scripts and working directories' },
  commonFields.runScripts,
  commonFields.description,
  commonFields.setEnv,
  { ...commonFields.startDirectoryLocal, half: true },
  { ...commonFields.startDirectory, half: true },
  commonFields.interactiveValues,
  commonFields.envLang,
  commonFields.encode,
  commonFields.type
]

// Telnet auth fields - similar to SSH but with filtered auth types (no privateKey)
export const telnetAuthFields = [
  { type: 'sectionHeader', title: 'Connection', description: 'Where to connect and how to label it' },
  commonFields.title,
  commonFields.category,
  { ...commonFields.host, half: true },
  { ...commonFields.port, half: true },

  { type: 'sectionHeader', title: 'Authentication', description: 'Credentials used for this session' },
  { type: 'profileItem', name: '__profile__', label: '', profileFilter: d => !isEmpty(d.telnet) },
  { ...commonFields.username, half: true },
  { ...commonFields.password, half: true },
  { ...commonFields.loginPrompt, half: true },
  { ...commonFields.passwordPrompt, half: true },

  { type: 'sectionHeader', title: 'On connect', description: 'Scripts and working directories' },
  commonFields.runScripts,
  commonFields.description,
  commonFields.setEnv,
  { ...commonFields.startDirectoryLocal, half: true },
  { ...commonFields.startDirectory, half: true },
  commonFields.interactiveValues,
  commonFields.encode,
  commonFields.type
]

// Common tab configurations - functions to ensure translation happens at render time
export const quickCommandsTab = () => ({
  key: 'quickCommands',
  label: e('quickCommands'),
  fields: [commonFields.quickCommands]
})

export const sshTunnelTab = () => ({
  key: 'tunnel',
  label: e('sshTunnel'),
  fields: [commonFields.sshTunnels]
})

export const connectionHoppingTab = () => ({
  key: 'connectionHopping',
  label: e('connectionHopping'),
  fields: [commonFields.connectionHopping]
})
