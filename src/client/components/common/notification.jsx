import React, { useState, useEffect, useRef } from 'react'
import { CloseOutlined, CopyOutlined } from '@ant-design/icons'
import classnames from 'classnames'
import generateId from '../../common/uid'
import { messageIcons } from '../../common/icon-helpers.jsx'
import { copy } from '../../common/clipboard'
import './notification.styl'

const notifications = []
const NOTIFICATION_EVENT = 'notification-update'

function addNotification (notif) {
  notifications.push(notif)
  window.dispatchEvent(new CustomEvent(NOTIFICATION_EVENT))
}

function removeNotification (key) {
  const index = notifications.findIndex(n => n.key === key)
  if (index > -1) {
    notifications.splice(index, 1)
    window.dispatchEvent(new CustomEvent(NOTIFICATION_EVENT))
  }
}

export const notification = {
  success: (options) => {
    addNotification({ ...options, type: 'success', key: options.key || generateId() })
  },
  error: (options) => {
    addNotification({ ...options, type: 'error', key: options.key || generateId() })
  },
  warning: (options) => {
    addNotification({ ...options, type: 'warning', key: options.key || generateId() })
  },
  info: (options) => {
    addNotification({ ...options, type: 'info', key: options.key || generateId() })
  },
  destroy: (key) => {
    if (key) {
      removeNotification(key)
    } else {
      notifications.length = 0
      window.dispatchEvent(new CustomEvent(NOTIFICATION_EVENT))
    }
  }
}

export function NotificationContainer () {
  const [nots, setNots] = useState([...notifications])

  useEffect(() => {
    const handler = () => setNots([...notifications])
    window.addEventListener(NOTIFICATION_EVENT, handler)
    return () => window.removeEventListener(NOTIFICATION_EVENT, handler)
  }, [])

  return (
    <div className='notification-container'>
      {nots.map(notif => (
        <NotificationItem
          key={notif.key}
          message={notif.message}
          description={notif.description}
          type={notif.type}
          duration={notif.duration}
          onClose={() => removeNotification(notif.key)}
        />
      ))}
    </div>
  )
}

function NotificationItem ({ message, description, type, onClose, duration = 18.5 }) {
  const timeoutRef = useRef(null)

  useEffect(() => {
    if (duration > 0) {
      timeoutRef.current = setTimeout(onClose, duration * 1000)
    }
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [])

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  const handleMouseLeave = () => {
    if (duration > 0 && !timeoutRef.current) {
      timeoutRef.current = setTimeout(onClose, duration * 1000)
    }
  }

  const handleCopy = (text, e) => {
    e.stopPropagation()
    copy(text)
  }

  const className = classnames('notification', type)

  return (
    <div
      className={className}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className='notification-content'>
        <div className='notification-message'>
          <div className='notification-icon'>{messageIcons[type]}</div>
          <div className='notification-title' title={message}>{message}</div>
          <CopyOutlined
            className='notification-copy-icon'
            onClick={(e) => handleCopy(message, e)}
          />
        </div>
        {description && (
          <div className='notification-description'>
            {description}
            <CopyOutlined
              className='notification-copy-icon'
              onClick={(e) => handleCopy(description, e)}
            />
          </div>
        )}
      </div>
      <CloseOutlined className='notification-close' onClick={onClose} />
    </div>
  )
}
