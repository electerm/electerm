/**
 * web form
 */

import {
  Input,
  Form,
  Button
} from 'antd'
import { formItemLayout, tailFormItemLayout } from '../../common/form-layout'

const FormItem = Form.Item
const e = window.translate

export default function VncForm (props) {
  const [form] = Form.useForm()

  const initialValues = props.types.reduce((acc, cur) => {
    acc[cur] = ''
    return acc
  }, {})
  function renderCommon () {
    const {
      types
    } = props
    return types.map((type, index) => {
      const Elem = type === 'password' ? Input.Password : Input
      return (
        <FormItem
          {...formItemLayout}
          label={e(type)}
          name={type}
          key={type}
          autoFocus={index === 0}
        >
          <Elem />
        </FormItem>
      )
    })
  }

  return (
    <Form
      form={form}
      onFinish={props.handleFinish}
      initialValues={initialValues}
      name='vnc-form'
    >
      <div className='pd3t pd1b'>
        {renderCommon()}
        <FormItem
          {...tailFormItemLayout}
        >
          <Button
            type='primary'
            htmlType='submit'
          >
            {e('submit')}
          </Button>
        </FormItem>
      </div>
    </Form>
  )
}
