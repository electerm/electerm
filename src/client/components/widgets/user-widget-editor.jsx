/**
 * User Widget Editor
 *
 * Modal component for creating or editing user-created widgets.
 * Features:
 *  - Code editor (textarea)
 *  - Test-run with configurable params
 *  - Save / Cancel
 */
import React, { useState, useEffect } from 'react'
import {
  Modal,
  Button,
  Input,
  Form,
  Alert,
  Spin,
  Space,
  Divider,
  Typography
} from 'antd'
import {
  PlayCircleOutlined,
  SaveOutlined
} from '@ant-design/icons'
import SimpleEditor from '../text-editor/simple-editor'

const { Text } = Typography
const e = window.translate

export default function UserWidgetEditor ({
  visible,
  widgetId, // undefined → create mode; string → edit mode
  initialCode, // pre-populated code string
  onSave, // (savedWidget) => void
  onCancel
}) {
  const [code, setCode] = useState('')
  const [testForm] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [testError, setTestError] = useState(null)
  const [parseError, setParseError] = useState(null)

  const isEditMode = !!widgetId

  // ── Init ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!visible) return
    setTestResult(null)
    setTestError(null)
    setParseError(null)
    if (initialCode) {
      setCode(initialCode)
    } else {
      // Fetch the default template
      window.store.getDefaultWidgetTemplate()
        .then(setCode)
        .catch(err => console.error('Failed to load template:', err))
    }
  }, [visible, initialCode])

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleCodeChange = (val) => {
    setCode(val)
    setParseError(null)
  }

  const handleTestRun = async () => {
    const config = testForm.getFieldsValue()
    setTesting(true)
    setTestResult(null)
    setTestError(null)
    try {
      const result = await window.store.testRunUserWidget(code, config)
      setTestResult(JSON.stringify(result, null, 2))
    } catch (err) {
      setTestError(err.message || String(err))
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setParseError(null)
    try {
      let saved
      if (isEditMode) {
        saved = await window.store.updateUserWidget(widgetId, code)
      } else {
        saved = await window.store.createUserWidget(code)
      }
      onSave && onSave(saved)
    } catch (err) {
      setParseError(err.message || String(err))
    } finally {
      setSaving(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const renderTestConfig = () => {
    // Simple key=value config inputs for quick test runs
    return (
      <Form
        form={testForm}
        layout='inline'
        size='small'
        className='mg1t'
      >
        <Form.Item
          label={e('testConfig') || 'Test config (JSON)'}
          name='__json__'
        >
          <Input.TextArea
            rows={2}
            style={{ width: 320 }}
            placeholder='{"key": "value"}'
            onChange={(ev) => {
              const val = ev.target.value
              try {
                const parsed = val ? JSON.parse(val) : {}
                testForm.setFieldsValue(parsed)
              } catch (_) {
                // ignore parse errors while typing
              }
            }}
          />
        </Form.Item>
      </Form>
    )
  }

  const title = isEditMode
    ? (e('editUserWidget') || 'Edit Widget')
    : (e('createUserWidget') || 'Create New Widget')

  const footer = (
    <Space>
      <Button onClick={onCancel}>
        {e('cancel') || 'Cancel'}
      </Button>
      <Button
        icon={<PlayCircleOutlined />}
        onClick={handleTestRun}
        loading={testing}
      >
        {e('testRun') || 'Test Run'}
      </Button>
      <Button
        type='primary'
        icon={<SaveOutlined />}
        onClick={handleSave}
        loading={saving}
      >
        {e('save') || 'Save'}
      </Button>
    </Space>
  )

  return (
    <Modal
      open={visible}
      title={title}
      onCancel={onCancel}
      width={800}
      footer={footer}
      destroyOnClose
    >
      <div style={{ minHeight: 400 }}>
        <div style={{ marginBottom: 8 }}>
          <Text type='secondary'>
            {e('widgetEditorHint') || 'Edit the widget code below. Use customRequire() instead of require() for third-party packages.'}
          </Text>
        </div>

        <SimpleEditor
          value={code}
          onChange={handleCodeChange}
          style={{ height: 320, fontFamily: 'monospace' }}
          rows={16}
        />

        {parseError && (
          <Alert
            type='error'
            message={parseError}
            showIcon
            className='mg1t'
          />
        )}

        <Divider orientation='left' plain>
          {e('testRun') || 'Test Run'}
        </Divider>

        {renderTestConfig()}

        {testing && <Spin className='mg1t' />}

        {testError && (
          <Alert
            type='error'
            message={testError}
            showIcon
            className='mg1t'
          />
        )}

        {testResult && (
          <Alert
            type='success'
            message={
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {testResult}
              </pre>
            }
            showIcon
            className='mg1t'
          />
        )}
      </div>
    </Modal>
  )
}
