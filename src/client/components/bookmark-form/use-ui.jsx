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
  Form
} from 'antd'
import { formItemLayout } from '../../common/form-layout'
import defaultSettings from '../../../app/common/default-setting'

const FormItem = Form.Item
const { prefix } = window
const e = prefix('form')
const s = prefix('setting')

export default function useBookmarkFormUI (props) {
  const {
    fontFamily: defaultFontFamily,
    fontSize: defaultFontSize,
    terminalType: defaultTerminalType
  } = defaultSettings
  const {
    fontFamily,
    fontSize,
    term = defaultTerminalType,
    envLang
  } = props.formData
  const { terminalTypes } = props.store.config
  return [
    <FormItem
      {...formItemLayout}
      label='ENV:LANG'
      key='envLang'
      rules={[{
        max: 130, message: '130 chars max'
      }]}
      initialValue={envLang}
      name='envLang'
    >
      <Input placeholder='en_US.UTF-8' />
    </FormItem>,
    <FormItem
      {...formItemLayout}
      key='terminalType'
      label={e('terminalType')}
      rules={[{
        required: true, message: 'terminal type required'
      }]}
      normalize={props.trim}
      initialValue={term}
      name='term'
    >
      <AutoComplete
        dataSource={terminalTypes}
      />
    </FormItem>,
    <FormItem
      {...formItemLayout}
      label={s('fontFamily')}
      key='fontFamily'
      name='fontFamily'
      rules={[{
        max: 130, message: '130 chars max'
      }]}
      initialValue={fontFamily}
    >
      <Input placeholder={defaultFontFamily + ''} />
    </FormItem>,
    <FormItem
      key='fontSize'
      {...formItemLayout}
      label={s('fontSize')}
      name='fontSize'
      initialValue={fontSize}
    >
      <InputNumber
        min={9}
        max={65535}
        step={1}
        placeholder={defaultFontSize}
      />
    </FormItem>
  ]
}
