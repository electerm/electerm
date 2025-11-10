/**
 * Widget form component
 */
import React from 'react'
import { Form, Input, InputNumber, Switch, Select, Button, message } from 'antd'
import { formItemLayout } from '../../common/form-layout'

export default function WidgetForm ({ widget, onSubmit, loading }) {
  const [form] = Form.useForm()

  if (!widget) {
    return null
  }

  const { info } = widget
  const { configs } = info

  const handleSubmit = async (values) => {
    try {
      await onSubmit(values)
      message.success('Widget started successfully')
    } catch (error) {
      message.error('Failed to start widget: ' + error.message)
    }
  }

  const renderFormItem = (config) => {
    const { name, type, default: defaultValue, description, choices } = config
    let control = null

    switch (type) {
      case 'string':
        control = <Input placeholder={description} />
        break
      case 'number':
        control = <InputNumber style={{ width: '100%' }} placeholder={description} />
        break
      case 'boolean':
        return (
          <Form.Item
            key={name}
            {...formItemLayout}
            label={name}
            name={name}
            valuePropName='checked'
            tooltip={description}
          >
            <Switch />
          </Form.Item>
        )
      default:
        control = <Input placeholder={description} />
    }

    if (choices && choices.length > 0) {
      control = (
        <Select placeholder={description}>
          {choices.map(choice => (
            <Select.Option key={choice} value={choice}>
              {choice}
            </Select.Option>
          ))}
        </Select>
      )
    }

    return (
      <Form.Item
        key={name}
        {...formItemLayout}
        label={name}
        name={name}
        tooltip={description}
        initialValue={defaultValue}
      >
        {control}
      </Form.Item>
    )
  }

  const initialValues = configs.reduce((acc, config) => {
    acc[config.name] = config.default
    return acc
  }, {})

  return (
    <div className='widget-form'>
      <div className='pd1b'>
        <h4>{info.name}</h4>
        <p>{info.description}</p>
      </div>
      <Form
        form={form}
        onFinish={handleSubmit}
        initialValues={initialValues}
        layout='horizontal'
      >
        {configs.map(renderFormItem)}
        <Form.Item
          {...formItemLayout}
          wrapperCol={{
            offset: formItemLayout.labelCol.span,
            span: formItemLayout.wrapperCol.span
          }}
        >
          <Button
            type='primary'
            htmlType='submit'
            loading={loading}
          >
            Start Widget
          </Button>
        </Form.Item>
      </Form>
    </div>
  )
}
