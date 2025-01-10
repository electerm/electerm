import {
  Form,
  Input,
  Button,
  AutoComplete,
  Modal
} from 'antd'
import { useEffect, useState } from 'react'

// Comprehensive API provider configurations
import providers from './providers'

const e = window.translate

export default function AIConfigForm ({ initialValues, onSubmit, showAIConfig }) {
  const [form] = Form.useForm()
  const [modelOptions, setModelOptions] = useState([])

  useEffect(() => {
    if (initialValues) {
      form.setFieldsValue(initialValues)
    }
  }, [initialValues])

  function filter () {
    return true
  }

  const getBaseURLOptions = () => {
    return providers.map(provider => ({
      value: provider.baseURL,
      label: provider.label
    }))
  }

  const getModelOptions = (baseURL) => {
    const provider = providers.find(p => p.baseURL === baseURL)
    if (!provider) return []

    return provider.models.map(model => ({
      value: model,
      label: model
    }))
  }

  const handleSubmit = async (values) => {
    onSubmit(values)
  }

  function handleCancel () {
    window.store.toggleAIConfig()
  }

  function handleChange (v) {
    const options = getModelOptions(v)
    setModelOptions(options)
    form.setFieldsValue({
      modelAI: options[0]?.value || ''
    })
  }

  if (!showAIConfig) {
    return null
  }
  const title = 'AI ' + e('setting')
  return (
    <Modal
      title={title}
      open
      onCancel={handleCancel}
      footer={null}
    >
      <Form
        form={form}
        onFinish={handleSubmit}
        initialValues={initialValues}
      >
        <Form.Item
          label='API URL'
          name='baseURLAI'
          rules={[
            { required: true, message: 'Please input or select API provider URL!' },
            { type: 'url', message: 'Please enter a valid URL!' }
          ]}
        >
          <AutoComplete
            options={getBaseURLOptions()}
            placeholder='Enter or select API provider URL'
            filterOption={filter}
            onChange={handleChange}
            allowClear
          />
        </Form.Item>

        <Form.Item
          label='Model'
          name='modelAI'
          rules={[{ required: true, message: 'Please input or select a model!' }]}
        >
          <AutoComplete
            options={modelOptions}
            placeholder='Enter or select AI model'
            filterOption={filter}
          />
        </Form.Item>

        <Form.Item
          label='API Key'
          name='apiKeyAI'
        >
          <Input.Password placeholder='Enter your API key' />
        </Form.Item>

        <Form.Item
          label='System Role'
          name='roleAI'
          rules={[{ required: true, message: 'Please input the AI role!' }]}
        >
          <Input.TextArea
            placeholder='Enter AI role/system prompt'
            rows={4}
          />
        </Form.Item>

        <Form.Item>
          <Button type='primary' htmlType='submit'>
            {e('save')}
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  )
}
