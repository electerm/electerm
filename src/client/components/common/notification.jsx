import React, { useState, useEffect, useRef } from 'react'
import { CloseOutlined, CopyOutlined } from '@ant-design/icons'
import classnames from 'classnames'
import generateId from '../../common/uid'
import { messageIcons } from '../../common/icon-helpers.jsx'
import { copy } from '../../common/clipboard'
import './notification.styl'

const notifications = []
const NOTIFICATION_EVENT = 'notification-update'

function getTextFromReactChildren (children) {
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children)
  }
  if (React.isValidElement(children)) {
    return getTextFromReactChildren(children.props.children)
  }
  if (Array.isArray(children)) {
    return children.map(getTextFromReactChildren).join('\n')
  }
  return ''
}

function addNotification (notif) {
  notif.descriptions = notif.description ? [notif.description] : []
  if (notif.type === 'error') {
    const messageText = getTextFromReactChildren(notif.message)
    const existingIndex = notifications.findIndex(n =>
      n.type === 'error' &&
      getTextFromReactChildren(n.message) === messageText
    )
    if (existingIndex > -1) {
      const existing = notifications[existingIndex]
      existing.count = (existing.count || 1) + 1
      existing.descriptions.push(notif.description)
      window.dispatchEvent(new CustomEvent(NOTIFICATION_EVENT))
      return
    }
    notif.count = 1
  }
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
          message={notif.message || notif.type}
          descriptions={notif.descriptions}
          type={notif.type}
          duration={notif.duration}
          count={notif.count || 1}
          onClose={() => removeNotification(notif.key)}
        />
      ))}
    </div>
  )
}

function NotificationItem ({ message, descriptions = [], type, onClose, duration = 18.5, count = 1 }) {
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
  }, [count])

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
    const textToCopy = getTextFromReactChildren(text)
    copy(textToCopy)
  }

  const className = classnames('notification', type)
  const titleText = getTextFromReactChildren(message)
  const title = count > 1 ? `(${count}) ${titleText}` : message
  const validDescriptions = descriptions.filter(Boolean)

  return (
    <div
      className={className}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className='notification-content'>
        <div className='notification-message'>
          <div className='notification-icon'>{messageIcons[type]}</div>
          <div className='notification-title' title={titleText}>{title}</div>
          <CopyOutlined
            className='notification-copy-icon'
            onClick={(e) => handleCopy(message, e)}
          />
        </div>
        {validDescriptions.length > 0 && (
          <div className='notification-description'>
            {validDescriptions.map((desc, i) => (
              <div key={i}>{desc}</div>
            ))}
            <CopyOutlined
              className='notification-copy-icon'
              onClick={(e) => handleCopy(validDescriptions, e)}
            />
          </div>
        )}
      </div>
      <CloseOutlined className='notification-close' onClick={onClose} />
    </div>
  )
}
