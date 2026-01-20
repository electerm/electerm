/**
 * Simple modal component without animation
 * Replaces antd Modal for better performance
 */

import { CloseOutlined } from '@ant-design/icons'
import classnames from 'classnames'
import React, { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './modal.styl'

export default function Modal (props) {
  const {
    open,
    title,
    width = 520,
    zIndex = 1000,
    className,
    wrapClassName,
    children,
    footer,
    maskClosable = true,
    onCancel
  } = props

  function handleMaskClick (e) {
    if (e.target === e.currentTarget && maskClosable && onCancel) {
      onCancel()
    }
  }

  function handleClose () {
    if (onCancel) {
      onCancel()
    }
  }

  if (!open) {
    return null
  }

  const modalStyle = {
    zIndex
  }

  const contentStyle = {
    width: typeof width === 'number' ? `${width}px` : width
  }

  const cls = classnames(
    'custom-modal-wrap',
    wrapClassName,
    className
  )

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e) => {
      const isConfirm = !!document.querySelector('.custom-modal-cancel-btn')
      if (e.key === 'Escape') {
        if (onCancel) {
          onCancel()
          e.preventDefault()
        }
      } else if ((e.key === 'Enter' || e.key === ' ') && !isConfirm) {
        // For info, Enter/Space closes
        if (onCancel) {
          onCancel()
          e.preventDefault()
        }
      } else if ((e.key === 'Enter' || e.key === ' ') && isConfirm) {
        // For confirm, Enter/Space confirms
        const okBtn = document.querySelector('.custom-modal-ok-btn')
        if (okBtn) {
          okBtn.click()
          e.preventDefault()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onCancel])

  return (
    <div className={cls} style={modalStyle}>
      <div
        className='custom-modal-mask'
        onClick={handleMaskClick}
      />
      <div className='custom-modal-container' onClick={handleMaskClick}>
        <div
          className='custom-modal-content'
          style={contentStyle}
        >
          {title && (
            <div className='custom-modal-header'>
              <div className='custom-modal-title'>{title}</div>
              <button
                type='button'
                className='custom-modal-close'
                onClick={handleClose}
              >
                <CloseOutlined />
              </button>
            </div>
          )}
          <div className='custom-modal-body'>
            {children}
          </div>
          {footer !== null && footer !== undefined && (
            <div className='custom-modal-footer'>
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function createModalInstance (type, options) {
  const {
    title,
    content,
    okText = 'OK',
    cancelText = 'Cancel',
    onOk,
    onCancel,
    ...rest
  } = options

  const container = document.createElement('div')
  document.body.appendChild(container)

  const root = createRoot(container)

  const destroy = () => {
    if (root && container && container.parentNode) {
      root.unmount()
      document.body.removeChild(container)
    }
  }

  const handleOk = () => {
    if (onOk) {
      onOk()
    }
    destroy()
  }

  const handleCancel = () => {
    if (onCancel) {
      onCancel()
    }
    destroy()
  }

  const hasCancel = type === 'confirm'

  const footer = (
    <div className='custom-modal-footer-buttons'>
      {hasCancel && (
        <button
          type='button'
          className='custom-modal-cancel-btn'
          onClick={handleCancel}
        >
          {cancelText}
        </button>
      )}
      <button
        type='button'
        className='custom-modal-ok-btn'
        onClick={handleOk}
      >
        {okText}
      </button>
    </div>
  )

  const modalProps = {
    ...rest,
    title,
    open: true,
    onCancel: hasCancel ? handleCancel : destroy,
    footer,
    children: content
  }

  root.render(<Modal {...modalProps} />)

  const update = (newOptions) => {
    const updatedOptions = { ...options, ...newOptions }
    const {
      title: newTitle,
      content: newContent,
      okText: newOkText = 'OK',
      cancelText: newCancelText = 'Cancel',
      onOk: newOnOk,
      onCancel: newOnCancel,
      ...newRest
    } = updatedOptions

    const newHandleOk = () => {
      if (newOnOk) {
        newOnOk()
      }
      destroy()
    }

    const newHandleCancel = () => {
      if (newOnCancel) {
        newOnCancel()
      }
      destroy()
    }

    const newFooter = (
      <div className='custom-modal-footer-buttons'>
        {hasCancel && (
          <button
            type='button'
            className='custom-modal-cancel-btn'
            onClick={newHandleCancel}
          >
            {newCancelText}
          </button>
        )}
        <button
          type='button'
          className='custom-modal-ok-btn'
          onClick={newHandleOk}
        >
          {newOkText}
        </button>
      </div>
    )

    const newModalProps = {
      ...newRest,
      title: newTitle,
      open: true,
      onCancel: hasCancel ? newHandleCancel : destroy,
      footer: newFooter,
      children: newContent
    }

    root.render(<Modal {...newModalProps} />)
  }

  return {
    destroy,
    update
  }
}

Modal.info = (options) => {
  return createModalInstance('info', options)
}

Modal.confirm = (options) => {
  return createModalInstance('confirm', options)
}
