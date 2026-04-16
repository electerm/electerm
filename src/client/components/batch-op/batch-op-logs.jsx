import React, { useState, useImperativeHandle, forwardRef, useEffect } from 'react'
import { refsStatic } from '../common/ref'

const STATIC_KEY = 'batch-op-logs'

const BatchOpLogs = forwardRef(function BatchOpLogs (_, ref) {
  const [logs, setLogsState] = useState(null)

  useImperativeHandle(ref, () => ({
    setLogs: (progress) => setLogsState(progress),
    reset: () => setLogsState(null)
  }))

  useEffect(() => {
    refsStatic.add(STATIC_KEY, {
      setLogs: (progress) => setLogsState(progress),
      reset: () => setLogsState(null)
    })
    return () => refsStatic.remove(STATIC_KEY)
  }, [])

  if (!logs || (!logs.steps.length && !logs.currentStep)) {
    return null
  }

  const statusIcon = { success: '✓', error: '✗' }

  return (
    <div className='batch-op-logs mg1t pd1 font13'>
      <div className='bold mg1b'>Execution Log</div>
      {logs.steps.map((step, i) => (
        <div key={i} className={`batch-op-log-entry ${step.status}`}>
          <span className='log-icon mg1r'>{statusIcon[step.status] || '○'}</span>
          <span className='log-name'>{step.name}</span>
          {step.error && <span className='log-error mg1l color-red'>{step.error}</span>}
        </div>
      ))}
      {logs.status === 'running' && logs.currentStep && (
        <div className='batch-op-log-entry running'>
          <span className='log-icon mg1r'>→</span>
          <span className='log-name'>{logs.currentStep}</span>
        </div>
      )}
      {logs.status === 'completed' && (
        <div className='batch-op-log-entry completed color-green mg1t'>
          ✓ Workflow completed
        </div>
      )}
    </div>
  )
})

export default BatchOpLogs
