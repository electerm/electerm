/**
 * Shared import progress modal.
 *
 * Mounted once in main.jsx (inside ConfigProvider, so antd theme applies)
 * and driven imperatively through refsStatic by runImportTask
 * (common/import-task.js) - same pattern as BatchOpRunner.
 * Uses only existing utility classes (pd1y/mg1t/elli/common-err).
 */

import { useCallback, useEffect, useState } from 'react'
import { Progress } from 'antd'
import Modal from './modal.jsx'
import { refsStatic } from './ref'
import { importProgressRefKey, cancelImportTask } from '../../common/import-task'

const e = window.translate

export default function ImportProgress () {
  const [state, setState] = useState(null)

  const show = useCallback((next) => {
    setState(next)
  }, [])

  const hide = useCallback(() => {
    setState(null)
  }, [])

  useEffect(() => {
    refsStatic.add(importProgressRefKey, { show, hide })
    return () => {
      refsStatic.remove(importProgressRefKey)
    }
  }, [show, hide])

  if (!state) {
    return null
  }
  const {
    title,
    status,
    current,
    total,
    label,
    error,
    cancelable
  } = state
  const running = status === 'running'
  const percent = Math.floor(current * 100 / (total || 1))
  const modalProps = {
    title: title || e('import'),
    open: true,
    width: 420,
    zIndex: 5000,
    maskClosable: false,
    onCancel: running
      ? (cancelable ? cancelImportTask : undefined)
      : hide,
    footer: running && !cancelable
      ? null
      : (
        <div className='custom-modal-footer-buttons'>
          <button
            type='button'
            className='custom-modal-cancel-btn'
            onClick={running ? cancelImportTask : hide}
          >
            {e('cancel')}
          </button>
        </div>
        )
  }
  return (
    <Modal {...modalProps}>
      <div className='pd1y'>
        <Progress
          percent={percent}
          status={status === 'error' ? 'exception' : 'active'}
          format={() => `${current}/${total}`}
        />
        <div className='elli mg1t'>{label}</div>
        {
          error
            ? <div className='common-err mg1t'>{error.message || String(error)}</div>
            : null
        }
      </div>
    </Modal>
  )
}
