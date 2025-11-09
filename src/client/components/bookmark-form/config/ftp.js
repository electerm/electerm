import { formItemLayout } from '../../../common/form-layout.js'
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
        { type: 'input', name: 'host', label: e('host'), rules: [{ required: true, message: e('host') + ' required' }] },
        commonFields.port,
        { type: 'profileItem', name: '__profile__', label: '', profileFilter: d => !isEmpty(d.ftp) },
        { type: 'input', name: 'user', label: e('username') },
        { type: 'password', name: 'password', label: e('password') },
        { type: 'switch', name: 'secure', label: e('secure'), valuePropName: 'checked' },
        commonFields.type
      ]
    }
  ]
}

export default ftpConfig
