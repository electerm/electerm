import { verticalFormItemLayout } from '../../../common/form-layout.js'
import { terminalRdpType } from '../../../common/constants.js'
import { createBaseInitValues, getAuthTypeDefault } from '../common/init-values.js'
import { isEmpty } from 'lodash-es'
import { commonFields, connectionHoppingTab } from './common-fields.js'

const e = window.translate

const rdpConfig = {
  key: 'rdp',
  type: terminalRdpType,
  initValues: (props) => {
    return createBaseInitValues(props, terminalRdpType, {
      port: 3389,
      connectionHoppings: [],
      ...getAuthTypeDefault(props)
    })
  },
  layout: verticalFormItemLayout,
  tabs: () => [
    {
      key: 'auth',
      label: e('auth'),
      fields: [
        {
          type: 'wiki',
          name: 'rdp-limitation-warning',
          link: 'https://github.com/electerm/electerm/wiki/RDP-limitation'
        },
        { type: 'sectionHeader', title: 'Connection', description: 'Where to connect and how to label it' },
        commonFields.colorTitle,
        commonFields.category,
        { type: 'input', name: 'host', label: () => e('host'), half: true, rules: [{ required: true, message: e('host') + ' required' }] },
        { ...commonFields.port, half: true },

        { type: 'sectionHeader', title: 'Authentication', description: 'Credentials used for this session' },
        { type: 'profileItem', name: '__profile__', label: '', profileFilter: d => !isEmpty(d.rdp) },
        { ...commonFields.username, half: true, rules: [{ required: true, message: e('username') + ' required' }] },
        { ...commonFields.password, half: true },
        { type: 'input', name: 'domain', label: () => e('domain'), half: true },

        { type: 'sectionHeader', title: 'On connect', description: 'Notes and connection proxy' },
        commonFields.description,
        commonFields.proxy,
        commonFields.type
      ]
    },
    connectionHoppingTab()
  ]
}

export default rdpConfig
