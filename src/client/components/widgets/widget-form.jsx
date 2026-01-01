/**
 * Widget form component
 */
import React from 'react'
import { Form, Input, InputNumber, Switch, Select, Button, Tooltip } from 'antd'
import { formItemLayout, tailFormItemLayout } from '../../common/form-layout'

export default function WidgetForm ({ widget, onSubmit, loading, hasRunningInstance }) {
  const [form] = Form.useForm()

  if (!widget) {
    return null
  }

  const { info } = widget
  const { configs, type, singleInstance } = info
  const isInstanceWidget = type === 'instance'
  const txt = isInstanceWidget ? 'Start widget' : 'Run widget'
  const isDisabled = loading || (singleInstance && hasRunningInstance)

  const handleSubmit = async (values) => {
    onSubmit(values)
  }

  const renderFormItem = (config) => {
    const { name, type, description, choices } = config
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
      <div className='pd1b alignright'>
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
          {...tailFormItemLayout}
        >
          <Tooltip title={isDisabled && singleInstance && hasRunningInstance ? 'Already running, only one instance allowed' : ''}>
            <Button
              type='primary'
              htmlType='submit'
              loading={loading}
              disabled={isDisabled}
            >
              {txt}
            </Button>
          </Tooltip>
        </Form.Item>
      </Form>
    </div>
  )
}
