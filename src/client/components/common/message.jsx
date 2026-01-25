import React, { useState, useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import {
  CloseOutlined
} from '@ant-design/icons'
import classnames from 'classnames'
import generateId from '../../common/uid'
import { messageIcons } from '../../common/icon-helpers.jsx'
import './message.styl'

let messageContainerRoot = null
const messageObservers = []

const subscribe = (onUpdate) => {
  messageObservers.push(onUpdate)
  return () => {
    const index = messageObservers.indexOf(onUpdate)
    if (index > -1) messageObservers.splice(index, 1)
  }
}

const notify = (messages) => {
  messageObservers.forEach(onUpdate => onUpdate([...messages]))
}

let activeMessages = []

function MessageItem ({ id, type, content, duration, onRemove, timestamp }) {
  const timeoutIdRef = useRef(null)

  useEffect(() => {
    if (duration !== 0) {
      const timer = setTimeout(onRemove, duration * 1000)
      timeoutIdRef.current = timer
      return () => {
        clearTimeout(timeoutIdRef.current)
        timeoutIdRef.current = null
      }
    }
  }, [duration, onRemove, timestamp])

  const handleMouseEnter = () => {
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current)
      timeoutIdRef.current = null
    }
  }

  const handleMouseLeave = () => {
    if (duration !== 0) {
      const timer = setTimeout(onRemove, duration * 1000)
      timeoutIdRef.current = timer
    }
  }

  return (
    <div
      className={classnames('message-item', type)}
      id={`message-${id}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className='message-content-wrap'>
        {messageIcons[type]}
        <div className='message-content'>{content}</div>
        <CloseOutlined className='message-close' onClick={onRemove} />
      </div>
    </div>
  )
}

function MessageContainer () {
  const [messages, setMessages] = useState(activeMessages)

  useEffect(() => {
    return subscribe(setMessages)
  }, [])

  const removeMessage = (id, onClose) => {
    activeMessages = activeMessages.filter(m => m.id !== id)
    notify(activeMessages)
    if (typeof onClose === 'function') {
      onClose()
    }
  }

  return (
    <div className='message-container'>
      {messages.map(msg => {
        const { key, ...props } = msg
        return (
          <MessageItem key={msg.id} {...props} onRemove={() => removeMessage(msg.id, msg.onClose)} />
        )
      })}
    </div>
  )
}

const init = () => {
  if (messageContainerRoot || typeof document === 'undefined') return
  const div = document.createElement('div')
  div.id = 'message-root'
  document.body.appendChild(div)
  messageContainerRoot = createRoot(div)
  messageContainerRoot.render(<MessageContainer />)
}

const addMessage = (type, content, duration = 3, onClose) => {
  let config = {
    content,
    duration,
    onClose,
    type
  }
  if (typeof content === 'object' && content !== null && !React.isValidElement(content)) {
    config = {
      ...config,
      ...content,
      type: content.type || type
    }
  }
  init()
  const id = config.key || generateId()
  const existingIndex = activeMessages.findIndex(m => m.id === id)
  const newMessage = {
    ...config,
    id,
    timestamp: Date.now()
  }
  if (existingIndex > -1) {
    activeMessages[existingIndex] = newMessage
  } else {
    activeMessages = [...activeMessages, newMessage]
  }
  notify(activeMessages)
  return {
    id,
    destroy: () => {
      activeMessages = activeMessages.filter(m => m.id !== id)
      notify(activeMessages)
    }
  }
}

const message = {
  info: (content, duration) => addMessage('info', content, duration),
  success: (content, duration) => addMessage('success', content, duration),
  warning: (content, duration) => addMessage('warning', content, duration),
  error: (content, duration) => addMessage('error', content, duration),
  destroy: () => {
    activeMessages = []
    notify(activeMessages)
  }
}

export default message
