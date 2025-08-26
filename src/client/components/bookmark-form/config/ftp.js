import { formItemLayout } from '../../../common/form-layout.js'
import { terminalFtpType } from '../../../common/constants.js'
import { createBaseInitValues } from '../common/init-values.js'
import { commonFields } from './common-fields.js'

const e = window.translate

const ftpConfig = {
  key: 'ftp',
  type: terminalFtpType,
  initValues: (props) => {
    return createBaseInitValues(props, terminalFtpType, {
      port: 21,
      user: '',
      password: '',
      secure: false
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
        { type: 'input', name: 'host', label: e('host'), rules: [{ required: true, message: e('host') + ' required' }] },
        commonFields.port,
        { type: 'input', name: 'user', label: e('username') },
        { type: 'password', name: 'password', label: e('password') },
        { type: 'switch', name: 'secure', label: e('secure'), valuePropName: 'checked' },
        commonFields.type
      ]
    }
  ]
}

export default ftpConfig
