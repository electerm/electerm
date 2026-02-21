import { formItemLayout } from '../../../common/form-layout.js'
import { terminalSpiceType } from '../../../common/constants.js'
import { createBaseInitValues, getAuthTypeDefault } from '../common/init-values.js'
import { isEmpty } from 'lodash-es'
import { commonFields, connectionHoppingTab } from './common-fields.js'

const e = window.translate

const spiceConfig = {
  key: 'spice',
  type: terminalSpiceType,
  initValues: (props) => {
    return createBaseInitValues(props, terminalSpiceType, {
      port: 5900,
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
        { type: 'input', name: 'host', label: () => e('host'), rules: [{ required: true, message: e('host') + ' required' }] },
        commonFields.port,
        { type: 'switch', name: 'viewOnly', label: () => e('viewOnly'), valuePropName: 'checked' },
        { type: 'switch', name: 'scaleViewport', label: () => e('scaleViewport'), valuePropName: 'checked' },
        { type: 'profileItem', name: '__profile__', label: '', profileFilter: d => !isEmpty(d.spice) },
        commonFields.password,
        commonFields.description,
        commonFields.proxy,
        commonFields.type
      ]
    },
    connectionHoppingTab()
  ]
}

export default spiceConfig
