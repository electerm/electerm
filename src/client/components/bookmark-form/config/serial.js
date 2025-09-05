import { formItemLayout } from '../../../common/form-layout.js'
import { terminalSerialType, commonBaudRates, commonDataBits, commonStopBits, commonParities } from '../../../common/constants.js'
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
      term: defaultSettings.terminalType,
      displayRaw: false,
      runScripts: [{}],
      ignoreKeyboardInteractive: false,
      ...getTerminalBackgroundDefaults(defaultSettings)
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
        { type: 'serialPathSelector', name: 'path', label: 'path', rules: [{ required: true, message: 'path required' }] },
        { type: 'autocomplete', name: 'baudRate', label: 'baudRate', options: commonBaudRates.map(d => ({ value: d })) },
        { type: 'select', name: 'dataBits', label: 'dataBits', options: commonDataBits.map(d => ({ value: d, label: d })) },
        { type: 'select', name: 'stopBits', label: 'stopBits', options: commonStopBits.map(d => ({ value: d, label: d })) },
        { type: 'select', name: 'parity', label: 'parity', options: commonParities.map(d => ({ value: d, label: d })) },
        { type: 'switch', name: 'lock', label: 'lock', valuePropName: 'checked' },
        { type: 'switch', name: 'rtscts', label: 'rtscts', valuePropName: 'checked' },
        { type: 'switch', name: 'xon', label: 'xon', valuePropName: 'checked' },
        { type: 'switch', name: 'xoff', label: 'xoff', valuePropName: 'checked' },
        { type: 'switch', name: 'xany', label: 'xany', valuePropName: 'checked' },
        commonFields.runScripts,
        commonFields.description,
        { type: 'input', name: 'type', label: 'type', hidden: true }
      ]
    },
    {
      key: 'settings',
      label: e('settings'),
      fields: [
        { type: 'terminalBackground', name: 'terminalBackground', label: e('terminalBackgroundImage') }
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
