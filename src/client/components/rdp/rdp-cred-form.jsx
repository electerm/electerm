/**
 * RDP credentials prompt form, shown at connect time
 * when username/password are missing from the bookmark
 */

import {
  Input,
  Form,
  Button
} from 'antd'
import { formItemLayout, tailFormItemLayout } from '../../common/form-layout'
import Password from '../common/password'

const FormItem = Form.Item
const e = window.translate

export default function RdpCredForm (props) {
  const [form] = Form.useForm()

  return (
    <Form
      form={form}
      onFinish={props.handleFinish}
      initialValues={props.initialValues || {}}
      name='rdp-cred-form'
    >
      <div className='pd3t pd1b'>
        <FormItem
          {...formItemLayout}
          label={e('username')}
          name='username'
        >
          <Input autoFocus />
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={e('password')}
          name='password'
        >
          <Password />
        </FormItem>
        <FormItem
          {...tailFormItemLayout}
        >
          <Button
            type='primary'
            htmlType='submit'
          >
            {e('connect')}
          </Button>
        </FormItem>
      </div>
    </Form>
  )
}
