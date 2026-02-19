import { formItemLayout } from '../../../common/form-layout.js'
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
      clipViewport: true,
      scaleViewport: true,
      qualityLevel: 3, // 0-9, lower = faster performance, default 6
      compressionLevel: 1, // 0-9, lower = faster performance, default 2
      shared: true,
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
        { type: 'switch', name: 'clipViewport', label: () => e('clipViewport'), valuePropName: 'checked' },
        { type: 'switch', name: 'scaleViewport', label: () => e('scaleViewport'), valuePropName: 'checked' },
        { type: 'number', name: 'qualityLevel', label: () => e('qualityLevel') + ' (0-9)', min: 0, max: 9, step: 1 },
        { type: 'number', name: 'compressionLevel', label: () => e('compressionLevel') + ' (0-9)', min: 0, max: 9, step: 1 },
        { type: 'profileItem', name: '__profile__', label: '', profileFilter: d => !isEmpty(d.vnc) },
        commonFields.username,
        commonFields.password,
        commonFields.description,
        commonFields.proxy,
        commonFields.type
      ]
    },
    connectionHoppingTab()
  ]
}

export default vncConfig
