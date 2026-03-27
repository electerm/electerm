import { formItemLayout } from '../../../common/form-layout.js'
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
  layout: formItemLayout,
  tabs: () => [
    {
      key: 'auth',
      label: e('auth'),
      fields: [
        commonFields.category,
        commonFields.colorTitle,
        commonFields.description,
        commonFields.enableTerminalImage,
        commonFields.runScripts,
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
