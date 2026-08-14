import { verticalFormItemLayout } from '../../../common/form-layout.js'
import { terminalSpiceType } from '../../../common/constants.js'
import { createBaseInitValues, getAuthTypeDefault } from '../common/init-values.js'
import { isEmpty } from 'lodash-es'
import { commonFields } from './common-fields.js'

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
        { type: 'profileItem', name: '__profile__', label: '', profileFilter: d => !isEmpty(d.spice) },
        commonFields.password,

        { type: 'sectionHeader', title: 'Display', description: 'Viewport options' },
        { type: 'switch', name: 'viewOnly', label: () => e('viewOnly'), valuePropName: 'checked' },
        { type: 'switch', name: 'scaleViewport', label: () => e('scaleViewport'), valuePropName: 'checked' },

        { type: 'sectionHeader', title: 'On connect', description: 'Notes and connection proxy' },
        commonFields.description,
        commonFields.proxy,
        commonFields.type
      ]
    }
  ]
}

export default spiceConfig
