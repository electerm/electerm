import {
  Form,
  Input
} from 'antd'
import { formItemLayout } from '../../common/form-layout'
import Password from '../common/password'

const FormItem = Form.Item
const e = window.translate

export default function ProfileFormSsh (props) {
  return (
    <>
      <FormItem
        {...formItemLayout}
        label={e('username')}
        hasFeedback
        name={['ftp', 'user']}
        rules={[{
          max: 128, message: '128 chars max'
        }]}
      >
        <Input />
      </FormItem>
      <FormItem
        {...formItemLayout}
        label={e('password')}
        hasFeedback
        name={['rdp', 'password']}
      >
        <Password />
      </FormItem>
    </>
  )
}
