import { formItemLayout } from '../../../common/form-layout.js'
import { terminalRdpType } from '../../../common/constants.js'
import { canUseNativeRdp } from '../../../common/native-rdp.js'
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
      nla: true,
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
        // manual, never on connect: see host-check.jsx
        { type: 'hostCheck', name: '__hostCheck__', label: 'Host check' },
        // the bookmark's decision, not something the client negotiates:
        // without NLA nothing authenticates the server, so no password is sent
        { type: 'switch', name: 'nla', label: 'Network level authentication (NLA)', valuePropName: 'checked' },
        // Hand the bookmark to mstsc.exe instead of the built-in IronRDP client:
        // the local client is the only way to get drive redirection, audio,
        // multi monitor and USB redirection (see the wiki link above), and the
        // only RDP client Windows 7 users have. Windows desktop only, because
        // the main process is what starts mstsc.
        {
          type: 'switch',
          name: 'nativeRdp',
          label: 'Open with the local RDP client (mstsc.exe)',
          valuePropName: 'checked',
          get hidden () {
            return !canUseNativeRdp()
          }
        },
        // stores/forgets the Windows credential mstsc picks up (native-rdp-win.js)
        { type: 'nativeRdpCredential', name: '__nativeRdpCredential__', label: '' },
        { type: 'profileItem', name: '__profile__', label: '', profileFilter: d => !isEmpty(d.rdp) },
        commonFields.username,
        commonFields.password,
        commonFields.usePasswordManager,
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
