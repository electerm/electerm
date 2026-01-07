import { formItemLayout } from '../../../common/form-layout.js'
import { terminalLocalType, terminalTypes } from '../../../common/constants.js'
import {
  createBaseInitValues,
  getTerminalDefaults,
  getSshDefaults,
  getTerminalBackgroundDefaults
} from '../common/init-values.js'
import defaultSettings from '../../../common/default-setting.js'
import { commonFields } from './common-fields.js'

const e = window.translate

const localConfig = {
  key: 'local',
  type: terminalLocalType,
  initValues: (props) => {
    const { store } = props
    return createBaseInitValues(props, terminalLocalType, {
      ...getTerminalDefaults(store),
      ...getSshDefaults(),
      ...getTerminalBackgroundDefaults(defaultSettings)
    })
  },
  layout: formItemLayout,
  tabs: () => [
    {
      key: 'auth',
      label: () => e('auth'),
      fields: [
        commonFields.category,
        commonFields.colorTitle,
        commonFields.description,
        { type: 'runScripts', name: 'runScripts', label: '' },
        { type: 'input', name: 'type', label: 'type', hidden: true }
      ]
    },
    {
      key: 'settings',
      label: () => e('settings'),
      fields: [
        {
          type: 'input',
          name: 'env.LANG',
          label: 'ENV:LANG',
          props: { maxLength: 130 }
        },
        {
          type: 'autocomplete',
          name: 'term',
          label: () => e('terminalType'),
          rules: [{ required: true, message: 'terminal type required' }],
          options: terminalTypes.map(t => ({ label: t, value: t }))
        },
        {
          type: 'switch',
          name: 'displayRaw',
          label: () => e('displayRaw'),
          valuePropName: 'checked'
        },
        {
          type: 'input',
          name: 'fontFamily',
          label: () => e('fontFamily'),
          rules: [{ max: 130, message: '130 chars max' }],
          props: { placeholder: defaultSettings.fontFamily }
        },
        {
          type: 'number',
          name: 'fontSize',
          label: () => e('fontSize'),
          props: {
            min: 9,
            max: 65535,
            step: 1,
            placeholder: defaultSettings.fontSize
          }
        },
        {
          type: 'number',
          name: 'keepaliveInterval',
          label: () => e('keepaliveIntervalDesc'),
          props: {
            min: 0,
            max: 20000000,
            step: 1000
          }
        },
        { type: 'terminalBackground', name: 'terminalBackground', label: () => e('terminalBackgroundImage') }
      ]
    },
    {
      key: 'quickCommands',
      label: () => e('quickCommands'),
      fields: [
        { type: 'quickCommands', name: '__quick__', label: '' }
      ]
    }
  ]
}

export default localConfig
