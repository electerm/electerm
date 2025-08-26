// SSH config using common fields
import { formItemLayout } from '../../../common/form-layout.js'
import { connectionMap, authTypeMap, defaultEnvLang } from '../../../common/constants.js'
import defaultSetting from '../../../common/default-setting.js'
import { createBaseInitValues, getTerminalDefaults, getSshDefaults, getTerminalBackgroundDefaults } from '../common/init-values.js'
import { sshAuthFields, sshSettings, quickCommandsTab, sshTunnelTab, connectionHoppingTab } from './common-fields.js'

const e = window.translate

const sshConfig = {
  key: connectionMap.ssh,
  type: connectionMap.ssh,
  initValues: (props) => {
    const { store } = props
    return createBaseInitValues(props, connectionMap.ssh, {
      port: 22,
      authType: authTypeMap.password,
      id: '',
      envLang: defaultEnvLang,
      enableSftp: true,
      sshTunnels: [],
      connectionHoppings: [],
      serverHostKey: [],
      cipher: [],
      ...getTerminalDefaults(store),
      ...getSshDefaults(),
      ...getTerminalBackgroundDefaults(defaultSetting)
    })
  },
  layout: formItemLayout,
  tabs: () => [
    {
      key: 'auth',
      label: e('auth'),
      fields: sshAuthFields
    },
    {
      key: 'settings',
      label: e('settings'),
      fields: sshSettings
    },
    quickCommandsTab(),
    sshTunnelTab(),
    connectionHoppingTab()
  ]
}
export default sshConfig
