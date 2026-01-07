import { formItemLayout } from '../../../common/form-layout.js'
import { terminalRdpType } from '../../../common/constants.js'
import { createBaseInitValues, getAuthTypeDefault } from '../common/init-values.js'
import { isEmpty } from 'lodash-es'
import { commonFields } from './common-fields.js'

const e = window.translate

const rdpConfig = {
  key: 'rdp',
  type: terminalRdpType,
  initValues: (props) => {
    return createBaseInitValues(props, terminalRdpType, {
      port: 3389,
      ...getAuthTypeDefault(props)
    })
  },
  layout: formItemLayout,
  tabs: () => [
    {
      key: 'auth',
      label: () => e('auth'),
      fields: [
        { type: 'rdpWarning', name: 'rdpWarning' },
        commonFields.category,
        commonFields.colorTitle,
        { type: 'input', name: 'host', label: () => e('host'), rules: [{ required: true, message: e('host') + ' required' }] },
        commonFields.port,
        { type: 'profileItem', name: '__profile__', label: '', profileFilter: d => !isEmpty(d.rdp) },
        { ...commonFields.username, rules: [{ required: true, message: e('username') + ' required' }] },
        { ...commonFields.password, rules: [{ required: true, message: e('password') + ' required' }] },
        commonFields.description,
        { type: 'input', name: 'domain', label: () => e('domain') },
        commonFields.type
      ]
    }
  ]
}

export default rdpConfig
