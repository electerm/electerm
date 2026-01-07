import { formItemLayout } from '../../../common/form-layout.js'
import { terminalTelnetType, authTypeMap } from '../../../common/constants.js'
import defaultSettings from '../../../common/default-setting.js'
import {
  createBaseInitValues,
  getSshDefaults,
  getTerminalBackgroundDefaults,
  getAuthTypeDefault
} from '../common/init-values.js'
import { telnetAuthFields, terminalSettings, quickCommandsTab } from './common-fields.js'

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
      ...getSshDefaults(),
      ...getTerminalBackgroundDefaults(defaultSettings),
      ...getAuthTypeDefault(props)
    })
  },
  layout: formItemLayout,
  tabs: () => [
    {
      key: 'auth',
      label: () => e('auth'),
      fields: telnetAuthFields
    },
    {
      key: 'settings',
      label: () => e('settings'),
      fields: terminalSettings
    },
    quickCommandsTab()
  ]
}

export default telnetConfig
