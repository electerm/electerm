import {
  Form,
  Input
} from 'antd'
import { formItemLayout } from '../../common/form-layout'

const FormItem = Form.Item
const e = window.translate

export default function ProfileFormRdp (props) {
  return (
    <>
      <FormItem
        {...formItemLayout}
        label={e('username')}
        hasFeedback
        name={['rdp', 'userName']}
      >
        <Input />
      </FormItem>
      <FormItem
        {...formItemLayout}
        label={e('password')}
        hasFeedback
        name={['rdp', 'password']}
      >
        <Input.Password />
      </FormItem>
    </>
  )
}
