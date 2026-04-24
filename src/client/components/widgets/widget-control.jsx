/**
 * Widget control component - shows form for a selected widget
 */
import React, { useState } from 'react'
import { Button } from 'antd'
import { EditOutlined } from '@ant-design/icons'
import WidgetForm from './widget-form'
import UserWidgetEditor from './user-widget-editor'
import { showMsg } from './widget-notification-with-details'

export default function WidgetControl ({ formData, widgetInstancesLength }) {
  const [loading, setLoading] = useState(false)
  const [editorVisible, setEditorVisible] = useState(false)
  const widget = formData

  if (!widget.id) {
    return (
      <div className='widget-control-empty aligncenter pd3'>
        <p>Select a widget to configure</p>
      </div>
    )
  }

  const hasRunningInstance = widgetInstancesLength > 0 && window.store.widgetInstances.some(
    instance => instance.widgetId === widget.id
  )

  const handleFormSubmit = async (config) => {
    setLoading(true)
    try {
      const result = await window.store.runWidget(widget.id, config)
      const { instanceId, success, error, msg } = result
      if (!instanceId) {
        if (success === false) {
          showMsg('Failed to run widget', 'error', null, 10, error || '')
        } else {
          showMsg(msg, 'success', null, 10)
        }
        return
      }
      const instance = {
        id: result.instanceId,
        title: `${widget.info.name} (${result.instanceId})`,
        widgetId: result.widgetId,
        serverInfo: result.serverInfo,
        config
      }
      window.store.widgetInstances.push(instance)
      if (config.autoRun) {
        window.store.toggleAutoRunWidget(instance)
      }
      showMsg(msg, 'success', result.serverInfo, 10)
    } catch (err) {
      console.error('Failed to run widget:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleEditorSave = (savedWidget) => {
    setEditorVisible(false)
    window.store.setSettingItem(savedWidget)
  }

  const openEditor = () => setEditorVisible(true)
  const closeEditor = () => setEditorVisible(false)

  const editCodeBtnProps = {
    size: 'small',
    icon: <EditOutlined />,
    onClick: openEditor
  }

  const widgetFormProps = {
    widget,
    onSubmit: handleFormSubmit,
    loading,
    hasRunningInstance
  }

  const userWidgetEditorProps = {
    visible: editorVisible,
    widgetId: widget.id,
    initialCode: widget.code,
    onSave: handleEditorSave,
    onCancel: closeEditor
  }

  return (
    <div className='widget-control'>
      {widget.userCreated && (
        <div className='pd1b alignright'>
          <Button {...editCodeBtnProps}>Edit Code</Button>
        </div>
      )}
      <WidgetForm {...widgetFormProps} />
      {widget.userCreated && (
        <UserWidgetEditor {...userWidgetEditorProps} />
      )}
    </div>
  )
}
