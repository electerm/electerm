import { verticalFormItemLayout } from '../../../common/form-layout.js'
import { terminalWebType } from '../../../common/constants.js'
import { createBaseInitValues } from '../common/init-values.js'
import { commonFields } from './common-fields.js'

const e = window.translate

const webConfig = {
  key: 'web',
  type: terminalWebType,
  initValues: (props) => {
    return createBaseInitValues(props, terminalWebType)
  },
  layout: verticalFormItemLayout,
  tabs: () => [
    {
      key: 'main',
      label: e('auth'),
      fields: [
        { type: 'sectionHeader', title: 'Connection', description: 'Where to connect and how to label it' },
        commonFields.colorTitle,
        commonFields.category,
        {
          type: 'input',
          name: 'url',
          label: () => e('URL'),
          rules: [
            { required: true, message: e('Please input URL') },
            {
              validator: (_, value) =>
                /^[a-z\d.+-]+:\/\/[^\s/$.?#].[^\s]*$/i.test(value)
                  ? Promise.resolve()
                  : Promise.reject(new Error(e('URL must start with http:// or https://')))
            }
          ]
        },

        { type: 'sectionHeader', title: 'On connect', description: 'Browser behavior and notes' },
        { type: 'input', name: 'useragent', label: () => e('useragent') },
        { type: 'switch', name: 'hideAddressBar', label: 'hideAddressBar', valuePropName: 'checked' },
        commonFields.description,
        commonFields.type
      ]
    }
  ]
}

export default webConfig
