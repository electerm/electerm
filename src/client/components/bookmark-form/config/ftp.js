import { verticalFormItemLayout } from '../../../common/form-layout.js'
import { terminalFtpType } from '../../../common/constants.js'
import { createBaseInitValues, getAuthTypeDefault } from '../common/init-values.js'
import { commonFields } from './common-fields.js'
import { isEmpty } from 'lodash-es'

const e = window.translate

const ftpConfig = {
  key: 'ftp',
  type: terminalFtpType,
  initValues: (props) => {
    return createBaseInitValues(props, terminalFtpType, {
      port: 21,
      user: '',
      password: '',
      secure: false,
      encode: 'utf-8',
      ...getAuthTypeDefault(props)
    })
  },
  layout: verticalFormItemLayout,
  tabs: () => [
    {
      key: 'auth',
      label: e('auth'),
      fields: [
        { type: 'sectionHeader', title: 'Connection', description: 'Where to connect and how to label it' },
        commonFields.colorTitle,
        commonFields.category,
        { type: 'input', name: 'host', label: () => e('host'), half: true, rules: [{ required: true, message: e('host') + ' required' }] },
        { ...commonFields.port, half: true },

        { type: 'sectionHeader', title: 'Authentication', description: 'Credentials used for this session' },
        { type: 'profileItem', name: '__profile__', label: '', profileFilter: d => !isEmpty(d.ftp) },
        { type: 'input', name: 'user', label: () => e('username'), half: true },
        { type: 'password', name: 'password', label: () => e('password'), half: true },
        { type: 'switch', name: 'secure', label: () => e('secure'), valuePropName: 'checked' },

        { type: 'sectionHeader', title: 'On connect', description: 'Encoding and connection proxy' },
        commonFields.encode,
        commonFields.proxy,
        commonFields.type
      ]
    }
  ]
}

export default ftpConfig
