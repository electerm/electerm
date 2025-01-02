import {
  Form,
  Input
} from 'antd'
import renderAuth from '../bookmark-form/render-auth-ssh'
import { formItemLayout } from '../../common/form-layout'

const FormItem = Form.Item
const e = window.translate

export default function ProfileFormSsh (props) {
  const { form } = props
  return (
    <>
      <FormItem
        {...formItemLayout}
        label={e('username')}
        hasFeedback
        name='username'
        rules={[{
          max: 128, message: '128 chars max'
        }]}
      >
        <Input />
      </FormItem>
      {
        renderAuth({
          store: props.store,
          form,
          authType: 'password'
        })
      }
      {
        renderAuth({
          store: props.store,
          form
        })
      }
    </>
  )
}
