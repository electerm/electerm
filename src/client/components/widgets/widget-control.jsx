/**
 * Widget control component - shows form for a selected widget
 */
import React, { useState } from 'react'
import WidgetForm from './widget-form'
import { showMsg } from './widget-notification-with-details'

export default function WidgetControl ({ formData, widgetInstancesLength }) {
  const [loading, setLoading] = useState(false)
  const [workflowProgress, setWorkflowProgress] = useState(null)
  const widget = formData
  if (!widget.id) {
    return (
      <div className='widget-control-empty aligncenter pd3'>
        <p>Select a widget to configure</p>
      </div>
    )
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

  const handleBatchOpExecute = async (config) => {
    setLoading(true)
    setWorkflowProgress({ steps: [], currentIndex: 0 })
    try {
      let workflows
      try {
        workflows = JSON.parse(config.workflowJson)
        if (!Array.isArray(workflows)) {
          throw new Error('Workflow must be an array')
        }
      } catch (e) {
        showMsg('Invalid workflow JSON: ' + e.message, 'error', null, 10)
        return
      }

      const results = []
      for (let i = 0; i < workflows.length; i++) {
        const step = workflows[i]
        setWorkflowProgress(prev => ({ ...prev, currentIndex: i, currentStep: step.name, status: 'running' }))

        let result
        try {
          result = await window.store.executeBatchStep(step, results)
          setWorkflowProgress(prev => ({
            ...prev,
            steps: [...prev.steps, { name: step.name, status: 'success', result }]
          }))
          results.push(result)
        } catch (e) {
          setWorkflowProgress(prev => ({
            ...prev,
            steps: [...prev.steps, { name: step.name, status: 'error', error: e.message }]
          }))
          showMsg(`Step "${step.name}" failed: ${e.message}`, 'error', null, 10)
          break
        }
      }

      const finalProgress = window.store.getBatchProgress()
      setWorkflowProgress(prev => ({ ...prev, status: 'completed', ...finalProgress }))
      showMsg('Workflow execution completed', 'success', null, 10)
    } catch (err) {
      console.error('Workflow execution failed:', err)
      showMsg('Workflow execution failed: ' + err.message, 'error', null, 10)
    } finally {
      setLoading(false)
    }
  }

  function renderProgress () {
    if (!workflowProgress || workflowProgress.steps.length === 0) {
      return null
    }
    return (
      <div className='batch-op-progress pd1y'>
        <h5>Progress:</h5>
        {workflowProgress.steps.map((step, i) => (
          <div key={i} className={`batch-op-step ${step.status}`}>
            <span className='step-status'>{step.status === 'success' ? '✓' : step.status === 'error' ? '✗' : '○'}</span>
            <span className='step-name'>{step.name}</span>
            {step.error && <span className='step-error'>{step.error}</span>}
          </div>
        ))}
        {workflowProgress.status === 'running' && (
          <div className='batch-op-step running'>
            <span className='step-status'>→</span>
            <span className='step-name'>{workflowProgress.currentStep}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className='widget-control'>
      {renderProgress()}
      <WidgetForm
        widget={widget}
        onSubmit={handleFormSubmit}
        onSubmitAsync={widget.info.type === 'frontend' ? handleBatchOpExecute : null}
        loading={loading}
        hasRunningInstance={hasRunningInstance}
      />
    </div>
  )
}
