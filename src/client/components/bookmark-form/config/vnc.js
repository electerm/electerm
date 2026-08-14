import { verticalFormItemLayout } from '../../../common/form-layout.js'
import { terminalVncType } from '../../../common/constants.js'
import { createBaseInitValues, getAuthTypeDefault } from '../common/init-values.js'
import { isEmpty } from 'lodash-es'
import { commonFields, connectionHoppingTab } from './common-fields.js'

const e = window.translate

const vncConfig = {
  key: 'vnc',
  type: terminalVncType,
  initValues: (props) => {
    return createBaseInitValues(props, terminalVncType, {
      port: 5900,
      viewOnly: false,
      clipViewport: false,
      scaleViewport: true,
      qualityLevel: 3, // 0-9, lower = faster performance, default 6
      compressionLevel: 1, // 0-9, lower = faster performance, default 2
      shared: true,
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
        { type: 'profileItem', name: '__profile__', label: '', profileFilter: d => !isEmpty(d.vnc) },
        { ...commonFields.username, half: true },
        { ...commonFields.password, half: true },

        { type: 'sectionHeader', title: 'Display', description: 'Viewport and image quality options' },
        { type: 'switch', name: 'viewOnly', label: () => e('viewOnly'), valuePropName: 'checked' },
        { type: 'switch', name: 'clipViewport', label: () => e('clipViewport'), valuePropName: 'checked' },
        { type: 'switch', name: 'scaleViewport', label: () => e('scaleViewport'), valuePropName: 'checked' },
        { type: 'number', name: 'qualityLevel', label: () => e('qualityLevel') + ' (0-9)', half: true, min: 0, max: 9, step: 1 },
        { type: 'number', name: 'compressionLevel', label: () => e('compressionLevel') + ' (0-9)', half: true, min: 0, max: 9, step: 1 },

        { type: 'sectionHeader', title: 'On connect', description: 'Notes and connection proxy' },
        commonFields.description,
        commonFields.proxy,
        commonFields.type
      ]
    },
    connectionHoppingTab()
  ]
}

export default vncConfig
