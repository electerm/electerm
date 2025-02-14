import {
  Form,
  Input,
  Button,
  AutoComplete,
  Modal,
  Alert,
  Space
} from 'antd'
import { useEffect, useState } from 'react'
import Link from '../common/external-link'
import {
  aiConfigWikiLink
} from '../../common/constants'

// Comprehensive API provider configurations
import providers from './providers'

const e = window.translate
const defaultRoles = [
  {
    value: 'Terminal expert, provide commands for different OS, explain usage briefly, use markdown format'
  },
  {
    value: '终端专家,提供不同系统下命令,简要解释用法,用markdown格式'
  }
]

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
  const defaultLangs = window.store.getLangNames().map(l => ({ value: l }))
  return (
    <Modal
      title={title}
      open
      onCancel={handleCancel}
      footer={null}
      width='90%'
    >
      <Alert
        message={
          <Link to={aiConfigWikiLink}>WIKI: {aiConfigWikiLink}</Link>
        }
        type='info'
        className='mg2y'
      />
      <Form
        form={form}
        onFinish={handleSubmit}
        initialValues={initialValues}
        layout='vertical'
      >
        <Form.Item label='API URL' required>
          <Space.Compact block>
            <Form.Item
              label='API URL'
              name='baseURLAI'
              noStyle
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
                style={{ width: '75%' }}
              />
            </Form.Item>
            <Form.Item
              label='API PATH'
              name='apiPathAI'
              noStyle
            >
              <Input
                placeholder='Enter API path'
                style={{ width: '25%' }}
              />
            </Form.Item>
          </Space.Compact>
        </Form.Item>
        <Form.Item
          label={e('modelAi')}
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
          label={e('roleAI')}
          name='roleAI'
          rules={[{ required: true, message: 'Please input the AI role!' }]}
        >
          <AutoComplete options={defaultRoles} placement='topLeft'>
            <Input.TextArea
              placeholder='Enter AI role/system prompt'
              rows={1}
            />
          </AutoComplete>
        </Form.Item>

        <Form.Item
          label={e('language')}
          name='languageAI'
          rules={[{ required: true, message: 'Please input language' }]}
        >
          <AutoComplete options={defaultLangs} placement='topLeft'>
            <Input
              placeholder={e('language')}
            />
          </AutoComplete>
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
