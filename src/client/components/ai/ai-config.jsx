import { Form, Input, Button, AutoComplete } from 'antd'
import { useEffect } from 'react'

// Comprehensive API provider configurations
import providers from './providers'

const e = window.translate

export default function AIConfigForm ({ initialValues, onSubmit }) {
  const [form] = Form.useForm()

  useEffect(() => {
    if (initialValues) {
      form.setFieldsValue(initialValues)
    }
  }, [initialValues])

  function filter (inputValue, option) {
    return option.label.toLowerCase().includes(inputValue.toLowerCase())
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

  return (
    <Form
      form={form}
      onFinish={handleSubmit}
      initialValues={initialValues}
    >
      <Form.Item
        label='API Provider URL'
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
        />
      </Form.Item>

      <Form.Item
        label='Model'
        name='modelAI'
        rules={[{ required: true, message: 'Please input or select a model!' }]}
      >
        <AutoComplete
          options={getModelOptions(form.getFieldValue('baseURL'))}
          placeholder='Enter or select AI model'
          filterOption={filter}
        />
      </Form.Item>

      <Form.Item
        label='API Key'
        name='apiKeyAI'
        rules={[{ required: true, message: 'Please input your API key!' }]}
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
        <Button>
          {e('save')}
        </Button>
      </Form.Item>
    </Form>

  )
}
