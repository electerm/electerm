import { formItemLayout } from '../../../common/form-layout.js'
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
      pingBeforeConnect: true,
      nlaFallback: true,
      nlaFallbackPassword: false,
      connectionHoppings: [],
      ...getAuthTypeDefault(props)
    })
  },
  layout: formItemLayout,
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
        commonFields.category,
        commonFields.colorTitle,
        { type: 'input', name: 'host', label: () => e('host'), rules: [{ required: true, message: e('host') + ' required' }] },
        commonFields.port,
        // rdp-session.jsx asks before connecting to a host that does not answer
        { type: 'switch', name: 'pingBeforeConnect', label: 'Check host (ping) first', valuePropName: 'checked' },
        // no password or a failed NLA logon: the Windows logon screen, see rdp-errors.js
        { type: 'switch', name: 'nlaFallback', label: 'Without NLA as fallback', valuePropName: 'checked' },
        // the fallback logs on with the password, see logonMode in rdp-errors.js
        { type: 'switch', name: 'nlaFallbackPassword', label: 'Send the password without NLA too (no server authentication)', valuePropName: 'checked' },
        { type: 'profileItem', name: '__profile__', label: '', profileFilter: d => !isEmpty(d.rdp) },
        commonFields.username,
        commonFields.password,
        commonFields.description,
        { type: 'input', name: 'domain', label: () => e('domain') },
        commonFields.proxy,
        commonFields.type
      ]
    },
    connectionHoppingTab()
  ]
}

export default rdpConfig
