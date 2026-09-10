/**
 * User Widget Editor
 *
 * Modal component for creating or editing user-created widgets.
 */
import React, { useState, useEffect } from 'react'
import {
  Modal,
  Button,
  Input,
  Space,
  Divider
} from 'antd'
import {
  PlayCircleOutlined,
  SaveOutlined
} from '@ant-design/icons'
import SimpleEditor from '../text-editor/simple-editor'
import { notification } from '../common/notification'
import './widget.styl'

export default function UserWidgetEditor ({
  visible,
  widgetId,
  initialCode,
  onSave,
  onCancel
}) {
  const [code, setCode] = useState('')
  const [testConfig, setTestConfig] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  const isEditMode = !!widgetId

  useEffect(() => {
    if (!visible) return
    setTestConfig('')
    if (initialCode) {
      setCode(initialCode)
    } else {
      window.store.getDefaultWidgetTemplate()
        .then(setCode)
        .catch(err => console.error('Failed to load template:', err))
    }
  }, [visible, initialCode])

  const handleCodeChange = (e) => {
    const val = e && e.target ? e.target.value : e
    setCode(val)
  }

  const handleTestConfigChange = (e) => {
    setTestConfig(e.target.value)
  }

  const handleTestRun = async () => {
    let config = {}
    if (testConfig.trim()) {
      try {
        config = JSON.parse(testConfig)
      } catch (_) {
        notification.error({ message: 'Invalid JSON in test config', duration: 5 })
        return
      }
    }
    setTesting(true)
    try {
      const result = await window.store.testRunUserWidget(code, config)
      notification.success({
        message: 'Test run succeeded',
        description: JSON.stringify(result, null, 2),
        duration: 10
      })
    } catch (err) {
      notification.error({
        message: 'Test run failed',
        description: err.message || String(err),
        duration: 10
      })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      let saved
      if (isEditMode) {
        saved = await window.store.updateUserWidget(widgetId, code)
      } else {
        saved = await window.store.createUserWidget(code)
      }
      onSave && onSave(saved)
    } catch (err) {
      notification.error({
        message: 'Failed to save widget',
        description: err.message || String(err),
        duration: 10
      })
    } finally {
      setSaving(false)
    }
  }

  const title = isEditMode ? 'Edit Widget' : 'Create New Widget'

  const cancelBtnProps = {
    onClick: onCancel
  }

  const testBtnProps = {
    icon: <PlayCircleOutlined />,
    onClick: handleTestRun,
    loading: testing
  }

  const saveBtnProps = {
    type: 'primary',
    icon: <SaveOutlined />,
    onClick: handleSave,
    loading: saving
  }

  const footer = (
    <Space>
      <Button {...cancelBtnProps}>Cancel</Button>
      <Button {...testBtnProps}>Test Run</Button>
      <Button {...saveBtnProps}>Save</Button>
    </Space>
  )

  const modalProps = {
    open: visible,
    title,
    onCancel,
    width: 800,
    footer,
    destroyOnClose: true
  }

  const editorProps = {
    value: code,
    onChange: handleCodeChange,
    rows: 16
  }

  const testConfigInputProps = {
    rows: 2,
    className: 'widget-editor-test-config',
    placeholder: '{"key": "value"}',
    value: testConfig,
    onChange: handleTestConfigChange
  }

  return (
    <Modal {...modalProps}>
      <div className='widget-editor-wrap'>
        <p className='widget-editor-hint'>
          Edit the widget code below. Use <code>customRequire()</code> instead of{' '}
          <code>require()</code> for third-party packages not bundled with the app.
        </p>
        <SimpleEditor {...editorProps} />
        <Divider orientation='left' plain>Test Run</Divider>
        <p className='widget-editor-config-label'>Test config (JSON)</p>
        <Input.TextArea {...testConfigInputProps} />
      </div>
    </Modal>
  )
}
