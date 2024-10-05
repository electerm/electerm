import {
  Form,
  Input
} from 'antd'
import { formItemLayout } from '../../common/form-layout'
import renderAuth from '../bookmark-form/render-auth-ssh'

const FormItem = Form.Item
const e = window.translate

export default function ProfileFormTelnet (props) {
  return (
    <>
      <FormItem
        {...formItemLayout}
        label={e('username')}
        hasFeedback
        name={['telnet', 'username']}
        rules={[{
          max: 128, message: '128 chars max'
        }]}
      >
        <Input />
      </FormItem>
      {
        renderAuth({
          store: props.store,
          form: props.form,
          authType: 'password',
          formItemName: ['telnet', 'password']
        })
      }
    </>
  )
}
