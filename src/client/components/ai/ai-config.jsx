import {
  Form,
  Input,
  InputNumber,
  Button,
  AutoComplete,
  Alert,
  Select,
  Space
} from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircleOutlined, ReloadOutlined } from '@ant-design/icons'
import Link from '../common/external-link'
import AiCache from './ai-cache'
import {
  aiConfigWikiLink
} from '../../common/constants'
import Password from '../common/password'
import message from '../common/message'
import { getAIPresets, getAIModelOptions, findAIPreset, getPresetBaseURLs, normalizeAIBaseURL } from './ai-presets'
import { appendMandatoryGuardrails } from './ai-guardrails'
import './ai-config.styl'

const STORAGE_KEY_MODELS = 'ai_models_cache'

function readModelsCache () {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_MODELS)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (e) {
    return {}
  }
}

function getCachedModels (baseURL) {
  const key = normalizeAIBaseURL(baseURL)
  if (!key) {
    return []
  }
  const models = readModelsCache()[key]
  return Array.isArray(models) ? models : []
}

function saveModelsToCache (baseURL, models) {
  const key = normalizeAIBaseURL(baseURL)
  if (!key) {
    return
  }
  try {
    const cache = readModelsCache()
    cache[key] = models
    window.localStorage.setItem(STORAGE_KEY_MODELS, JSON.stringify(cache))
  } catch (e) {
    // storage full or disabled, keep it in memory only
  }
}

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

// The wire protocol is detected from the path:
// /chat/completions -> OpenAI compatible, /responses -> OpenAI Responses API,
// /messages -> Anthropic Claude Messages API
const apiPathOptions = [
  { value: '/chat/completions', label: '/chat/completions (OpenAI)' },
  { value: '/responses', label: '/responses (OpenAI Responses)' },
  { value: '/messages', label: '/messages (Anthropic)' }
]

const authHeaderOptions = [
  { value: 'Authorization: Bearer' },
  { value: 'x-api-key' },
  { value: 'api-key' },
  { value: 'Authorization: Api-Key' },
  { value: 'Authorization' }
]

export default function AIConfigForm ({ initialValues, onSubmit, onApply, applied }) {
  const [form] = Form.useForm()
  const applyOnSave = useRef(true)
  const [testing, setTesting] = useState(false)
  const [loadingModels, setLoadingModels] = useState(false)
  const [cachedModels, setCachedModels] = useState([])
  // True while the list came from an explicit fetch rather than from the cache
  const [modelsFetched, setModelsFetched] = useState(false)
  const baseURLAI = Form.useWatch('baseURLAI', form)
  const apiPathAI = Form.useWatch('apiPathAI', form)
  const presets = useMemo(() => getAIPresets(), [])
  const currentPreset = findAIPreset(baseURLAI, presets)
  const baseURLOptions = getPresetBaseURLs(currentPreset).map(value => ({ value }))

  // Restore the model list previously fetched for this API URL
  useEffect(() => {
    setCachedModels(getCachedModels(baseURLAI))
    setModelsFetched(false)
  }, [baseURLAI])

  function filter () {
    return true
  }

  function handleSubmit (values) {
    onSubmit(values, applyOnSave.current)
    applyOnSave.current = true
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

  async function handleLoadModels () {
    const values = form.getFieldsValue()
    const baseURL = normalizeAIBaseURL(values.baseURLAI)
    if (!baseURL) {
      message.error('Please input API URL first')
      return
    }
    setLoadingModels(true)
    try {
      const res = await window.pre.runGlobalAsync(
        'AIlistModels',
        baseURL,
        values.apiKeyAI,
        values.authHeaderNameAI,
        values.proxyAI
      )
      if (res && res.error) {
        message.error(res.error)
      } else if (res && res.models && res.models.length) {
        setCachedModels(res.models)
        setModelsFetched(true)
        saveModelsToCache(baseURL, res.models)
        message.success(`Got ${res.models.length} models`)
        if (!values.modelAI) {
          const options = getAIModelOptions(baseURL, null, res.models, true)
          form.setFieldsValue({ modelAI: options[0]?.value })
        }
      } else {
        message.error('No models found in response')
      }
    } catch (e) {
      if (e.message) {
        message.error(e.message)
      }
    } finally {
      setLoadingModels(false)
    }
  }

  function handleSelectPreset (preset) {
    const fields = ['nameAI', 'baseURLAI', 'apiPathAI', 'modelAI', 'authHeaderNameAI', 'apiKeyAI']
    const values = currentPreset?.id === preset.id ? {} : { apiKeyAI: '' }
    fields.forEach(f => {
      if (preset[f] !== undefined) {
        values[f] = preset[f]
      }
    })
    form.setFieldsValue(values)
  }

  // A plain antd Select, on purpose: it already scrolls its list inside the
  // viewport (a Dropdown menu grows past the bottom of a phone screen, so the
  // tail of the preset list is unreachable there) and `showSearch` filters it.
  // `optionFilterProp` is load-bearing: without it rc-select filters on the
  // option *value* (our id), so "gemini" or "llama" match nothing. The label
  // carries name and model, so filtering on it finds either.
  // The label/select sizing lives in `.ai-preset-row` (ai-config.styl), because
  // Space's `.ant-space-item` wrapper is the flex item, not the child.
  function renderPresetSelect () {
    const options = presets.map(p => ({
      value: p.id,
      label: p.modelAI ? `${p.nameAI} · ${p.modelAI}` : p.nameAI
    }))
    return (
      <div className='ai-config-toolbar'>
        {initialValues.id && (
          <Button onClick={onApply} disabled={applied} icon={<CheckCircleOutlined aria-hidden />}>
            {e(applied ? 'selected' : 'apply')}
          </Button>
        )}
        <Space className='mg1b width-100 ai-preset-row'>
          <span>{e('presets')}</span>
          <Select
            showSearch
            optionFilterProp='label'
            options={options}
            value={currentPreset?.id}
            onSelect={id => handleSelectPreset(presets.find(p => p.id === id))}
          />
        </Space>
      </div>
    )
  }

  function renderApiKeyLabel () {
    const siteUrl = currentPreset?.siteUrl
    if (siteUrl) {
      const name = currentPreset?.nameAI || baseURLAI
      return <span className='bold'>API Key (<Link to={siteUrl}>get API key from {name}</Link>)</span>
    }
    return 'API Key'
  }

  // Presets with more than one host let the user pick one; single-host presets
  // keep the plain input so custom endpoints never show an empty dropdown.
  function renderApiURLInput () {
    if (baseURLOptions.length < 2) {
      return <Input placeholder='Enter API provider URL' style={{ width: '75%' }} />
    }
    // Keep every host visible: the input already holds one of them, so a
    // value-based filter would hide the very URL the user wants to switch to.
    return (
      <AutoComplete
        options={baseURLOptions}
        filterOption={filter}
        popupMatchSelectWidth={false}
        style={{ width: '75%' }}
      >
        <Input placeholder='Enter API provider URL' />
      </AutoComplete>
    )
  }

  function renderModelInput () {
    const options = getAIModelOptions(baseURLAI, currentPreset, cachedModels, modelsFetched)
    const title = 'Fetch model list from API URL'
    return (
      <AutoComplete
        options={options}
        filterOption={filter}
      >
        <Input
          placeholder='Enter or select AI model'
          suffix={
            <ReloadOutlined
              spin={loadingModels}
              className='pointer ai-model-reload'
              title={title}
              onMouseDown={e => e.preventDefault()}
              onClick={handleLoadModels}
            />
          }
        />
      </AutoComplete>
    )
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
      {renderPresetSelect()}
      <p className='ai-config-url'>
        Full URL: {baseURLAI}{apiPathAI}
      </p>
      <Form
        form={form}
        onFinish={handleSubmit}
        onFinishFailed={() => { applyOnSave.current = true }}
        initialValues={initialValues}
        layout='vertical'
        className='ai-config-form'
      >
        <Form.Item
          label={e('name')}
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
              {renderApiURLInput()}
            </Form.Item>
            <Form.Item
              label='API PATH'
              name='apiPathAI'
              rules={[
                { required: true, message: 'Please input API PATH' }
              ]}
              noStyle
            >
              <AutoComplete
                options={apiPathOptions}
                filterOption={filter}
                placeholder='/chat/completions'
                popupMatchSelectWidth={false}
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
          {renderModelInput()}
        </Form.Item>

        <Form.Item
          label='Context length'
          name='contextLengthAI'
          tooltip='How many tokens this model can hold in one request. Leave empty to guess from the model name; the chat panel uses it to show how full the context is.'
        >
          <InputNumber
            placeholder='auto (detect from model name)'
            min={1000}
            step={1000}
            style={{ width: '100%' }}
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
          rules={[{ required: true, message: e('required') }]}
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
          <Space wrap>
            <Button type='primary' htmlType='submit'>
              {e('saveAndApply')}
            </Button>
            <Button
              onClick={() => {
                applyOnSave.current = false
                form.submit()
              }}
            >
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
      <AiCache />
    </>
  )
}
