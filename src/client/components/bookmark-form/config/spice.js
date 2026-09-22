import { formItemLayout } from '../../../common/form-layout.js'
import { terminalSpiceType } from '../../../common/constants.js'
import { createBaseInitValues, getAuthTypeDefault } from '../common/init-values.js'
import { isEmpty } from 'lodash-es'
import { commonFields } from './common-fields.js'

const e = window.translate

/**
 * window.translate echoes an unknown key back capitalised, so a key that is
 * only in ~/dev/electerm-locales and not yet in the published
 * @electerm/electerm-locales renders as "Tls". Fall back to the literal until
 * the translation ships, the same way vv-file-field.jsx does.
 */
function label (key, fallback) {
  const t = e(key)
  return t === key.charAt(0).toUpperCase() + key.slice(1) ? fallback : t
}

const spiceConfig = {
  key: 'spice',
  type: terminalSpiceType,
  initValues: (props) => {
    return createBaseInitValues(props, terminalSpiceType, {
      port: 5900,
      tls: false,
      ca: '',
      hostSubject: '',
      viewOnly: false,
      scaleViewport: true,
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
        commonFields.category,
        commonFields.colorTitle,
        { type: 'vvFile', name: '__vv__', label: '' },
        { type: 'input', name: 'host', label: () => e('host'), rules: [{ required: true, message: e('host') + ' required' }] },
        commonFields.port,
        { type: 'switch', name: 'tls', label: () => label('tls', 'TLS'), valuePropName: 'checked' },
        {
          type: 'textarea',
          name: 'ca',
          label: () => label('caCert', 'CA certificate (PEM)'),
          props: {
            autoSize: { minRows: 2, maxRows: 8 },
            placeholder: '-----BEGIN CERTIFICATE-----'
          }
        },
        {
          type: 'input',
          name: 'hostSubject',
          label: () => label('hostSubject', 'Certificate subject'),
          props: {
            placeholder: 'CN=pve1,O=Proxmox Virtual Environment'
          }
        },
        { type: 'switch', name: 'viewOnly', label: () => e('viewOnly'), valuePropName: 'checked' },
        { type: 'switch', name: 'scaleViewport', label: () => e('scaleViewport'), valuePropName: 'checked' },
        { type: 'profileItem', name: '__profile__', label: '', profileFilter: d => !isEmpty(d.spice) },
        commonFields.password,
        commonFields.description,
        commonFields.proxy,
        commonFields.type
      ]
    }
  ]
}

export default spiceConfig
