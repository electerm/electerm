/**
 * Widget control component - shows form for a selected widget
 */
import React, { useState } from 'react'
import { Alert } from 'antd'
import WidgetForm from './widget-form'
import CustomWidgetPanel from './custom-widget-panel'
import CustomWidgetForm from './custom-widget-form'
import { showMsg } from './widget-notification-with-details'

export default function WidgetControl ({ formData, widgetInstancesLength }) {
  const [loading, setLoading] = useState(false)
  const widget = formData
  if (!widget.id) {
    return (
      <div className='widget-control-empty aligncenter pd3'>
        <p>Select a widget to configure</p>
      </div>
    )
  }

  // A widget folder that failed to load is listed on purpose: silence here is
  // what makes a broken custom widget impossible to diagnose.
  if (widget.state === 'error') {
    return (
      <div className='widget-control pd2'>
        <Alert
          type='error'
          showIcon
          title={widget.info && widget.info.name ? widget.info.name : widget.id}
          description={widget.error}
        />
      </div>
    )
  }

  // A user widget that ships its own UI (electerm.ui in its package.json)
  // renders that instead of the generated config form.
  if (widget.info && widget.info.ui) {
    return <CustomWidgetPanel widget={widget} />
  }

  // Config mode: no ui, frontend type — electerm draws the form from
  // electerm.configs and shows the action's result in the same panel.
  if (
    widget.builtin === false &&
    widget.info &&
    widget.info.type === 'frontend'
  ) {
    return <CustomWidgetForm widget={widget} />
  }

  // Check if this widget already has a running instance
  // widgetInstancesLength is used to trigger re-render when instances change
  const hasRunningInstance = widgetInstancesLength > 0 && window.store.widgetInstances.some(
    instance => instance.widgetId === widget.id
  )

  const handleFormSubmit = async (config) => {
    setLoading(true)
    try {
      const result = await window.store.runWidget(widget.id, config)
      const {
        instanceId,
        success,
        error,
        msg
      } = result
      if (!instanceId) {
        if (success === false) {
          showMsg('Failed to run widget', 'error', null, 10, error || '')
        } else {
          showMsg(msg, 'success', null, 10)
        }
        return
      }
      // Add instance to the store
      const instance = {
        id: result.instanceId,
        title: `${widget.info.name} (${result.instanceId})`,
        widgetId: result.widgetId,
        serverInfo: result.serverInfo,
        config,
        startedAt: Date.now()
      }
      // assigned, not pushed: see deleteWidgetInstance in store/widgets.js
      window.store.widgetInstances = [...window.store.widgetInstances, instance]
      if (config.autoRun) {
        window.store.toggleAutoRunWidget(instance)
      }
      showMsg(msg, 'success', result.serverInfo, 10)
    } catch (err) {
      console.error('Failed to run widget:', err)
      showMsg(`Failed to run widget: ${err.message}`, 'error', null, 10)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='widget-control'>
      <WidgetForm
        widget={widget}
        onSubmit={handleFormSubmit}
        loading={loading}
        hasRunningInstance={hasRunningInstance}
      />
    </div>
  )
}
