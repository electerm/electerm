import {
  Form,
  Input,
  Button,
  AutoComplete,
  Alert,
  Space,
  Dropdown
} from 'antd'
import { useEffect, useState } from 'react'
import { DownOutlined } from '@ant-design/icons'
import Link from '../common/external-link'
import AiCache from './ai-cache'
import {
  aiConfigWikiLink
} from '../../common/constants'
import Password from '../common/password'
import AiHistory, { addHistoryItem } from './ai-history'
import message from '../common/message'
import { getAIPresets } from './ai-config-props'
import { appendMandatoryGuardrails } from './ai-guardrails'

const STORAGE_KEY_CONFIG = 'ai_config_history'
const EVENT_NAME_CONFIG = 'ai-config-history-update'

const e = window.translate
const defaultRoles = [
  {
    value: 'Terminal expert, provide commands for different OS, explain usage briefly, use markdown format'
  },
  {
    value: '终端专家,提供不同系统下命令,简要解释用法,用markdown格式'
  }
]

const proxyOptions = [
  { value: 'socks5://127.0.0.1:1080' },
  { value: 'http://127.0.0.1:8080' },
  { value: 'https://proxy.example.com:3128' }
]

const authHeaderOptions = [
  { value: 'Authorization: Bearer' },
  { value: 'x-api-key' },
  { value: 'api-key' },
  { value: 'Authorization: Api-Key' },
  { value: 'Authorization' }
]

export default function AIConfigForm ({ initialValues, onSubmit, showAIConfig }) {
  const [form] = Form.useForm()
  const [testing, setTesting] = useState(false)
  const baseURLAI = Form.useWatch('baseURLAI', form)

  useEffect(() => {
    if (initialValues) {
      form.setFieldsValue(initialValues)
    }
  }, [initialValues])

  function filter () {
    return true
  }

  const handleSubmit = async (values) => {
    onSubmit(values)
    addHistoryItem(STORAGE_KEY_CONFIG, values, EVENT_NAME_CONFIG)
  }

  const handleTest = async () => {
    try {
      const values = await form.validateFields()
      setTesting(true)
      const res = await window.pre.runGlobalAsync(
        'AIchat',
        'Hi',
        values.modelAI,
        appendMandatoryGuardrails(values.roleAI),
        values.baseURLAI,
        values.apiPathAI,
        values.apiKeyAI,
        values.proxyAI,
        false,
        values.authHeaderNameAI
      )
      if (res && res.error) {
        message.error(res.error)
      } else if (res && res.response) {
        message.success('AI config works!')
      } else {
        message.error('Unexpected response from AI API')
      }
    } catch (e) {
      if (e.message) {
        message.error(e.message)
      }
    } finally {
      setTesting(false)
    }
  }

  function handleSelectHistory (item) {
    if (item && typeof item === 'object') {
      form.setFieldsValue(item)
    }
  }

  function handleSelectPreset (preset) {
    const fields = ['nameAI', 'baseURLAI', 'apiPathAI', 'modelAI', 'authHeaderNameAI', 'modelAI', 'apiKeyAI']
    const values = {}
    fields.forEach(f => {
      if (preset[f] !== undefined) {
        values[f] = preset[f]
      }
    })
    form.setFieldsValue(values)
  }

  function renderPresetMenu () {
    const presets = getAIPresets()
    const items = presets.map(p => ({
      key: p.id,
      label: p.nameAI,
      onClick: () => handleSelectPreset(p)
    }))
    return (
      <Dropdown menu={{ items }} trigger={['click']}>
        <Button>
          {e('presets') || 'Presets'} <DownOutlined />
        </Button>
      </Dropdown>
    )
  }

  function renderHistoryItem (item) {
    if (!item || typeof item !== 'object') return { label: 'Unknown', title: 'Unknown' }
    const name = item.nameAI || ''
    const model = item.modelAI || 'Default Model'
    const rolePrefix = item.roleAI ? item.roleAI.substring(0, 15) + '...' : ''
    const label = name || `[${model}] ${rolePrefix}`
    const title = name
      ? `${name}\nModel: ${item.modelAI}\nURL: ${item.baseURLAI}`
      : `Model: ${item.modelAI}\nRole: ${item.roleAI}\nURL: ${item.baseURLAI}`
    return { label, title }
  }

  function renderApiKeyLabel () {
    if (baseURLAI === 'https://api.atlascloud.ai/v1') {
      return <span className='bold'>API Key (<Link to='https://www.atlascloud.ai/?utm_source=electerm_app&utm_medium=link&utm_campaign=electerm'>get API key from atlascloud</Link>)</span>
    }
    if (baseURLAI === 'https://ai.electerm.org/api/ai') {
      return <span className='bold'>API Key (<Link to='https://ai.electerm.org?utm=electerm'>get API key from ai.electerm.org(free)</Link>)</span>
    }
    return 'API Key'
  }

  if (!showAIConfig) {
    return null
  }
  const defaultLangs = window.store.getLangNames().map(l => ({ value: l }))
  return (
    <>
      <Alert
        title={
          <Link to={aiConfigWikiLink}>WIKI: {aiConfigWikiLink}</Link>
        }
        type='info'
        className='mg2t mg1b'
      />
      <Alert
        title={
          window.translate('aiWarn')
        }
        type='warning'
        className='mg2b'
      />
      <div className='mg1b alignright'>
        {renderPresetMenu()}
      </div>
      <p>
        Full Url: {initialValues?.baseURLAI}{initialValues?.apiPathAI}
      </p>
      <Form
        form={form}
        onFinish={handleSubmit}
        initialValues={initialValues}
        layout='vertical'
        className='ai-config-form'
      >
        <Form.Item
          label='Name'
          name='nameAI'
        >
          <Input
            placeholder='e.g. DeepSeek Relay, Local Ollama (optional)'
          />
        </Form.Item>
        <Form.Item label='API URL' required>
          <Space.Compact className='width-100'>
            <Form.Item
              label='API URL'
              name='baseURLAI'
              noStyle
              rules={[
                { required: true, message: 'Please input or select API provider URL!' },
                { type: 'url', message: 'Please enter a valid URL!' }
              ]}
            >
              <Input
                placeholder='Enter API provider URL'
                style={{ width: '75%' }}
              />
            </Form.Item>
            <Form.Item
              label='API PATH'
              name='apiPathAI'
              rules={[
                { required: true, message: 'Please input API PATH' }
              ]}
              noStyle
            >
              <Input
                placeholder='/chat/completions'
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
          <Input
            placeholder='Enter or select AI model'
          />
        </Form.Item>

        <Form.Item
          label={renderApiKeyLabel()}
          name='apiKeyAI'
        >
          <Password placeholder='Enter your API key' />
        </Form.Item>

        <Form.Item
          label='Auth Header'
          name='authHeaderNameAI'
          tooltip='Header format for API authentication. e.g. "Authorization: Bearer" sends "Authorization: Bearer <key>", "x-api-key" sends "x-api-key: <key>"'
        >
          <AutoComplete
            options={authHeaderOptions}
            filterOption={filter}
          >
            <Input placeholder='e.g. Authorization: Bearer' />
          </AutoComplete>
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

        <Form.Item
          label={e('proxy')}
          name='proxyAI'
          tooltip='Proxy for AI API requests (e.g., socks5://127.0.0.1:1080)'
        >
          <AutoComplete
            options={proxyOptions}
            filterOption={filter}
            allowClear
          >
            <Input placeholder='Enter proxy URL (optional)' />
          </AutoComplete>
        </Form.Item>

        <Form.Item>
          <Space>
            <Button type='primary' htmlType='submit'>
              {e('save')}
            </Button>
            <Button
              loading={testing}
              onClick={handleTest}
            >
              {e('testConnection')}
            </Button>
          </Space>
        </Form.Item>
      </Form>
      <AiHistory
        storageKey={STORAGE_KEY_CONFIG}
        eventName={EVENT_NAME_CONFIG}
        onSelect={handleSelectHistory}
        renderItem={renderHistoryItem}
      />
      <AiCache />
    </>
  )
}
