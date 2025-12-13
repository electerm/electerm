/**
 * Widget control component - shows form for a selected widget
 */
import React, { useState } from 'react'
import WidgetForm from './widget-form'

export default function WidgetControl ({ formData }) {
  const [loading, setLoading] = useState(false)
  const widget = formData
  if (!widget.id) {
    return (
      <div className='widget-control-empty aligncenter pd3'>
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
    } catch (err) {
      console.error('Failed to run widget:', err)
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
