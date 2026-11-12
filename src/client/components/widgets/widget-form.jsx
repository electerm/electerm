/**
 * Widget form component
 */
import React, { useState, useEffect, useMemo } from 'react'
import { Form, Button, Tooltip, Alert } from 'antd'
import { tailFormItemLayout } from '../../common/form-layout'
import HelpIcon from '../common/help-icon'
import BatchOpEditor from '../batch-op/batch-op-editor'
import {
  rememberedValues,
  rememberValues
} from '../../common/widget-form-memory'
import {
  renderConfigItem,
  configInitialValues
} from './config-fields'

export default function WidgetForm ({ widget, onSubmit, loading, hasRunningInstance }) {
  const [form] = Form.useForm()
  const [showDownloadWarning, setShowDownloadWarning] = useState(false)
  // The run form starts from the values the last run used — a server widget is
  // normally started with the same host, port and directory every time. Secrets
  // are excluded, see common/widget-form-memory.js.
  const info = widget && widget.info
  const configs = (info && info.configs) || []
  const widgetId = widget && widget.id
  const startValues = useMemo(() => ({
    ...configInitialValues(configs),
    ...rememberedValues(widgetId, configs)
  }), [widgetId, configs])

  useEffect(() => {
    let timer
    if (loading) {
      timer = setTimeout(() => {
        setShowDownloadWarning(true)
      }, 3000)
    } else {
      setShowDownloadWarning(false)
    }
    return () => {
      if (timer) {
        clearTimeout(timer)
      }
    }
  }, [loading])

  if (!widget) {
    return null
  }

  const { type, singleInstance } = info
  const isInstanceWidget = type === 'instance'
  const isFrontendWidget = type === 'frontend'
  const txt = isInstanceWidget ? 'Start widget' : 'Run widget'
  const isDisabled = loading || (singleInstance && hasRunningInstance)

  const handleSubmit = async (values) => {
    rememberValues(widgetId, configs, values)
    onSubmit(values)
  }

  function renderWarn () {
    if (!showDownloadWarning) {
      return null
    }
    return (
      <Alert
        title='Downloading package may take some time on first use...'
        type='warning'
        showIcon
        className='mg1t'
      />
    )
  }

  if (isFrontendWidget && info.name === 'Batch Operation') {
    return <BatchOpEditor widget={widget} />
  }

  return (
    <div className='widget-form'>
      <div className='pd1b alignright'>
        <h4>
          {info.name}
          {info.name === 'MCP Server' && (
            <HelpIcon link='https://github.com/electerm/electerm/wiki/MCP-Widget-Usage-Guide' />
          )}
        </h4>
        <p>{info.description}</p>
      </div>

      <Form
        form={form}
        onFinish={handleSubmit}
        onValuesChange={(_, allValues) => rememberValues(widgetId, configs, allValues)}
        initialValues={startValues}
        layout='horizontal'
      >
        {configs.map(config => renderConfigItem(config, form))}
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
          {renderWarn()}
        </Form.Item>
      </Form>
    </div>
  )
}
