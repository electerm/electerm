import {
  Form,
  Input
} from 'antd'
import { formItemLayout } from '../../common/form-layout'

const FormItem = Form.Item
const e = window.translate

export default function ProfileFormVnc (props) {
  return (
    <>
      <FormItem
        {...formItemLayout}
        label={e('username')}
        hasFeedback
        name={['vnc', 'username']}
      >
        <Input />
      </FormItem>
      <FormItem
        {...formItemLayout}
        label={e('password')}
        hasFeedback
        name={['vnc', 'password']}
      >
        <Input.Password />
      </FormItem>
    </>
  )
}
