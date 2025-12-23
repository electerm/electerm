/**
 * Simple modal component without animation
 * Replaces antd Modal for better performance
 */

import { CloseOutlined } from '@ant-design/icons'
import classnames from 'classnames'
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
