/**
 * bookmark form
 */
import {
  Switch,
  Form
} from 'antd'
import { formItemLayout } from '../../common/form-layout'

const FormItem = Form.Item

export default function renderX11 () {
  return (
    <FormItem
      {...formItemLayout}
      label='x11'
      name='x11'
      valuePropName='checked'
    >
      <Switch />
    </FormItem>
  )
}
