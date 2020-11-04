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
import mapper from '../../common/auto-complete-data-mapper'
import { defaultEnvLang } from '../../common/constants'

const FormItem = Form.Item
const { prefix } = window
const e = prefix('form')
const s = prefix('setting')

export default function useBookmarkFormUI (props) {
  const {
    fontFamily: defaultFontFamily,
    fontSize: defaultFontSize
  } = defaultSettings
  const { terminalTypes } = props.store.config
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
      label={s('fontFamily')}
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
      label={s('fontSize')}
      name='fontSize'
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
