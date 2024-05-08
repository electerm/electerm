/**
 * web form
 */

import { useEffect } from 'react'
import {
  Input,
  Form,
  InputNumber
} from 'antd'
import { formItemLayout } from '../../common/form-layout'
import {
  newBookmarkIdPrefix,
  terminalRdpType
} from '../../common/constants'
import useSubmit from './use-submit'
import copy from 'json-deep-copy'
import { defaults } from 'lodash-es'
import { ColorPickerItem } from './color-picker-item.jsx'
import { getRandomDefaultColor } from '../../common/rand-hex-color.js'

const FormItem = Form.Item
const { prefix } = window
const e = prefix('form')

export default function LocalFormUi (props) {
  const [
    form,
    handleFinish,
    submitUi
  ] = useSubmit(props)
  useEffect(() => {
    if (props.formData.id.startsWith(newBookmarkIdPrefix)) {
      form.setFieldsValue({
        category: props.currentBookmarkGroupId
      })
    }
  }, [props.currentBookmarkGroupId])
  let initialValues = copy(props.formData)
  const defaultValues = {
    type: terminalRdpType,
    port: 3389,
    color: getRandomDefaultColor()
  }
  initialValues = defaults(initialValues, defaultValues)
  function renderCommon () {
    return (
      <div className='pd1x'>
        <FormItem
          {...formItemLayout}
          label={e('title')}
          hasFeedback
        >
          <FormItem noStyle name='title'>
            <Input addonBefore={<ColorPickerItem />} />
          </FormItem>
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={e('host')}
          hasFeedback
          name='host'
          required
        >
          <Input />
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={e('port')}
          hasFeedback
          name='port'
          rules={[{
            required: true, message: 'port required'
          }]}
        >
          <InputNumber
            placeholder={e('port')}
            min={1}
            max={65535}
            step={1}
          />
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={e('username')}
          hasFeedback
          name='username'
          required
        >
          <Input />
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={e('password')}
          hasFeedback
          name='password'
          required
        >
          <Input.Password />
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={e('description')}
          name='description'
          hasFeedback
        >
          <Input.TextArea rows={1} />
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={e('domain')}
          hasFeedback
          name='domain'
        >
          <Input />
        </FormItem>
        <FormItem
          {...formItemLayout}
          label='type'
          name='type'
          className='hide'
        >
          <Input />
        </FormItem>
      </div>
    )
  }

  return (
    <Form
      form={form}
      onFinish={handleFinish}
      initialValues={initialValues}
      name='rdp-form'
    >
      {renderCommon()}
      {submitUi}
    </Form>
  )
}
