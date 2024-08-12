import {
  Form,
  Switch
} from 'antd'

import { formItemLayout } from '../../common/form-layout'

const FormItem = Form.Item
const e = window.translate

export default function renderEnableSftp () {
  return [
    <FormItem
      {...formItemLayout}
      label='SSH'
      name='enableSsh'
      key='ssh'
      valuePropName='checked'
    >
      <Switch />
    </FormItem>,
    <FormItem
      {...formItemLayout}
      label={e('ignoreKeyboardInteractive')}
      name='ignoreKeyboardInteractive'
      key='ignoreKeyboardInteractive'
      valuePropName='checked'
    >
      <Switch />
    </FormItem>
  ]
}
