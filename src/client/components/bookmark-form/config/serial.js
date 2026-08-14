import { verticalFormItemLayout } from '../../../common/form-layout.js'
import { terminalSerialType, commonBaudRates, commonDataBits, commonStopBits, commonParities, commonTxLineEndings, commonRxLineEndings } from '../../../common/constants.js'
import defaultSettings from '../../../common/default-setting.js'
import { createBaseInitValues, getTerminalBackgroundDefaults } from '../common/init-values.js'
import { commonFields } from './common-fields.js'

const e = window.translate

const serialConfig = {
  key: 'serial',
  type: terminalSerialType,
  initValues: (props) => {
    return createBaseInitValues(props, terminalSerialType, {
      baudRate: 9600,
      dataBits: 8,
      lock: true,
      stopBits: 1,
      parity: 'none',
      rtscts: false,
      xon: false,
      xoff: false,
      xany: false,
      closeSequence: '\\x01ky',
      closeSequenceDelay: 500,
      term: defaultSettings.terminalType,
      displayRaw: false,
      runScripts: [{}],
      ignoreKeyboardInteractive: false,
      ...getTerminalBackgroundDefaults(defaultSettings)
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
        { type: 'serialPathSelector', name: 'path', label: 'path', half: true, rules: [{ required: true, message: 'path required' }] },
        {
          type: 'autocomplete',
          name: 'baudRate',
          label: 'baudRate',
          half: true,
          options: commonBaudRates.map(d => ({ value: d.toString(), label: d.toString() })),
          normalize: (value) => {
            if (value === '' || value == null) {
              return undefined
            }
            const numValue = Number(value)
            return isNaN(numValue) ? undefined : numValue
          }
        },

        { type: 'sectionHeader', title: 'Port settings', description: 'Data framing and flow control' },
        { type: 'select', name: 'dataBits', label: 'dataBits', half: true, options: commonDataBits.map(d => ({ value: d, label: d })) },
        { type: 'select', name: 'stopBits', label: 'stopBits', half: true, options: commonStopBits.map(d => ({ value: d, label: d })) },
        { type: 'select', name: 'parity', label: 'parity', half: true, options: commonParities.map(d => ({ value: d, label: d })) },
        { type: 'switch', name: 'lock', label: 'lock', half: true, valuePropName: 'checked' },
        { type: 'switch', name: 'rtscts', label: 'rtscts', half: true, valuePropName: 'checked' },
        { type: 'switch', name: 'xon', label: 'xon', half: true, valuePropName: 'checked' },
        { type: 'switch', name: 'xoff', label: 'xoff', half: true, valuePropName: 'checked' },
        { type: 'switch', name: 'xany', label: 'xany', half: true, valuePropName: 'checked' },
        { type: 'select', name: 'txLineEnding', label: 'txLineEnding', half: true, options: commonTxLineEndings.map(d => ({ value: d.value, label: d.label })) },
        { type: 'select', name: 'rxLineEnding', label: 'rxLineEnding', half: true, options: commonRxLineEndings.map(d => ({ value: d.value, label: d.label })) },
        {
          type: 'input',
          name: 'closeSequence',
          label: e('closeSequence'),
          half: true,
          props: { placeholder: '\\x01ky' }
        },
        {
          type: 'number',
          name: 'closeSequenceDelay',
          label: e('closeSequenceDelay'),
          half: true,
          props: { min: 0, max: 10000, step: 100 }
        },

        { type: 'sectionHeader', title: 'On connect', description: 'Scripts and notes' },
        commonFields.runScripts,
        commonFields.description,
        { type: 'input', name: 'type', label: 'type', hidden: true }
      ]
    },
    {
      key: 'settings',
      label: e('settings'),
      fields: [
        { type: 'terminalBackground', name: 'terminalBackground', label: () => e('terminalBackgroundImage') }
      ]
    },
    {
      key: 'quickCommands',
      label: e('quickCommands'),
      fields: [
        { type: 'quickCommands', name: '__quick__', label: '' }
      ]
    }
  ]
}

export default serialConfig
