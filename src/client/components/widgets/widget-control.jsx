/**
 * Widget control component - shows form for a selected widget
 */
import React, { useState } from 'react'
import WidgetForm from './widget-form'

export default function WidgetControl ({ widget, onInstanceCreated }) {
  const [loading, setLoading] = useState(false)

  if (!widget) {
    return (
      <div className='widget-control-empty'>
        <p>Select a widget to configure</p>
      </div>
    )
  }

  const handleFormSubmit = async (config) => {
    setLoading(true)
    try {
      const result = await window.store.runWidget(widget.id, config)
      // Add instance to the store
      const instance = {
        id: result.instanceId,
        title: `${widget.info.name} (${result.instanceId})`,
        widgetId: result.widgetId,
        serverInfo: result.serverInfo,
        config
      }
      window.store.widgetInstances.push(instance)
      if (onInstanceCreated) {
        onInstanceCreated(instance)
      }
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
      />
    </div>
  )
}
