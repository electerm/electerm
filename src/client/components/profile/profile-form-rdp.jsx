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
        label={e('userName')}
        hasFeedback
        name='rdp.userName'
        required
      >
        <Input />
      </FormItem>
      <FormItem
        {...formItemLayout}
        label={e('password')}
        hasFeedback
        name='rdp.password'
        required
      >
        <Input.Password />
      </FormItem>
    </>
  )
}
