/**
 * ui forms render
 */

/**
 * bookmark form
 */

import {
  Input,
  InputNumber,
  AutoComplete,
  Form,
  Switch
} from 'antd'
import { formItemLayout } from '../../common/form-layout'
import defaultSettings from '../../common/default-setting'
import mapper from '../../common/auto-complete-data-mapper'
import { defaultEnvLang, terminalTypes } from '../../common/constants'

const FormItem = Form.Item
const e = window.translate

export default function useBookmarkFormUI (props) {
  const {
    fontFamily: defaultFontFamily,
    fontSize: defaultFontSize
  } = defaultSettings
  return [
    <FormItem
      {...formItemLayout}
      label='ENV:LANG'
      key='envLang'
      rules={[{
        max: 130, message: '130 chars max'
      }]}
      name='envLang'
    >
      <Input placeholder={defaultEnvLang} />
    </FormItem>,
    <FormItem
      {...formItemLayout}
      key='terminalType'
      label={e('terminalType')}
      rules={[{
        required: true, message: 'terminal type required'
      }]}
      normalize={props.trim}
      name='term'
    >
      <AutoComplete
        options={terminalTypes.map(mapper)}
      />
    </FormItem>,
    <FormItem
      {...formItemLayout}
      label={e('displayRaw')}
      name='displayRaw'
      key='displayRaw'
      valuePropName='checked'
    >
      <Switch />
    </FormItem>,
    <FormItem
      {...formItemLayout}
      label={e('fontFamily')}
      key='fontFamily'
      name='fontFamily'
      rules={[{
        max: 130, message: '130 chars max'
      }]}
    >
      <Input placeholder={defaultFontFamily + ''} />
    </FormItem>,
    <FormItem
      key='fontSize'
      {...formItemLayout}
      label={e('fontSize')}
      name='fontSize'
    >
      <InputNumber
        min={9}
        max={65535}
        step={1}
        placeholder={defaultFontSize}
      />
    </FormItem>,
    <FormItem
      key='keepaliveInterval'
      {...formItemLayout}
      label={e('keepaliveIntervalDesc')}
      name='keepaliveInterval'
    >
      <InputNumber
        min={0}
        max={20000000}
        step={1000}
      />
    </FormItem>
  ]
}
