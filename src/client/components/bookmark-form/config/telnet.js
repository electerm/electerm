import { formItemLayout } from '../../../common/form-layout.js'
import { terminalTelnetType, authTypeMap } from '../../../common/constants.js'
import defaultSettings from '../../../common/default-setting.js'
import {
  createBaseInitValues,
  getSshDefaults,
  getTerminalBackgroundDefaults,
  getAuthTypeDefault
} from '../common/init-values.js'
import { telnetAuthFields, terminalSettings, lineEndingFields, commonFields, quickCommandsTab, triggersTab } from './common-fields.js'

const e = window.translate

const telnetConfig = {
  key: 'telnet',
  type: terminalTelnetType,
  initValues: (props) => {
    return createBaseInitValues(props, terminalTelnetType, {
      port: 23,
      id: '',
      username: 'root',
      password: 'guest',
      authType: authTypeMap.password,
      term: defaultSettings.terminalType,
      txLineEnding: '\r',
      rxLineEnding: 'none',
      ...getSshDefaults(),
      ...getTerminalBackgroundDefaults(defaultSettings),
      ...getAuthTypeDefault(props)
    })
  },
  layout: formItemLayout,
  tabs: () => [
    {
      key: 'auth',
      label: e('auth'),
      fields: telnetAuthFields
    },
    {
      key: 'settings',
      label: e('settings'),
      // Line endings sit with the rest of the terminal behaviour, and the
      // background picker stays last - it is the one field that renders a
      // whole sub-form
      fields: [
        ...terminalSettings.slice(0, -1),
        ...lineEndingFields,
        commonFields.terminalBackground
      ]
    },
    quickCommandsTab(),
    triggersTab()
  ]
}

export default telnetConfig
