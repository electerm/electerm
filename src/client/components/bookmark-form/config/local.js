import { verticalFormItemLayout } from '../../../common/form-layout.js'
import { terminalLocalType } from '../../../common/constants.js'
import {
  createBaseInitValues,
  getTerminalDefaults,
  getSshDefaults,
  getTerminalBackgroundDefaults
} from '../common/init-values.js'
import defaultSettings from '../../../common/default-setting.js'
import { commonFields } from './common-fields.js'

const e = window.translate

const localConfig = {
  key: 'local',
  type: terminalLocalType,
  initValues: (props) => {
    const { store } = props
    return createBaseInitValues(props, terminalLocalType, {
      ...getTerminalDefaults(store),
      ...getSshDefaults(),
      ...getTerminalBackgroundDefaults(defaultSettings)
    })
  },
  layout: verticalFormItemLayout,
  tabs: () => [
    {
      key: 'auth',
      label: e('auth'),
      fields: [
        { type: 'sectionHeader', title: 'Connection', description: 'How to label this session' },
        commonFields.colorTitle,
        commonFields.category,

        { type: 'sectionHeader', title: 'On connect', description: 'Scripts and notes' },
        commonFields.enableTerminalImage,
        commonFields.runScripts,
        commonFields.description,
        { type: 'input', name: 'type', label: 'type', hidden: true }
      ]
    },
    {
      key: 'settings',
      label: e('settings'),
      fields: [
        commonFields.terminalType,
        commonFields.displayRaw,
        commonFields.fontFamily,
        commonFields.fontSize,
        commonFields.keepaliveInterval,
        commonFields.terminalBackground,
        // Exec settings - stored as flat properties on bookmark
        { type: 'execSettings' }
      ]
    },
    {
      key: 'quickCommands',
      label: e('quickCommands'),
      fields: [
        commonFields.quickCommands
      ]
    }
  ]
}

export default localConfig
