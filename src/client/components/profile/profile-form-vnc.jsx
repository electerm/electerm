import {
  Form,
  Input
} from 'antd'
import { formItemLayout } from '../../common/form-layout'
import Password from '../common/password'

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
        <Password />
      </FormItem>
    </>
  )
}
