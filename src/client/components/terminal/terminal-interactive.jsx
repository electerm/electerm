/**
 * handle terminal interactive operation - queue based
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import wait from '../../common/wait'
import TermInteractiveUI from './terminal-interactive-ui'
import ExternalLink from '../common/external-link.jsx'
import { notification } from '../common/notification'

export default function TermInteractive () {
  const [current, setCurrent] = useState(null)
  const queueRef = useRef([])
  const hasCurrentRef = useRef(false)

  function updateTab (data) {
    window.store.updateTab(data.tabId, data.update)
  }

  function notifyProxyCommandMessage (data) {
    const lines = (data.message || '').split('\n')
    const title = lines[0] || 'ssh proxy command'
    const body = lines.slice(1).join('\n').trim()
    // make any http(s) link in the message clickable (SSO login url)
    const renderBody = (text) => {
      const parts = text.split(/(https?:\/\/\S+)/)
      return (
        <pre className='pd0 mg0 overflow-auto'>
          {
            parts.map((part, i) => /^https?:\/\//.test(part)
              ? <ExternalLink key={i} to={part}>{part}</ExternalLink>
              : part)
          }
        </pre>
      )
    }
    notification.info({
      message: title,
      description: body
        ? renderBody(body)
        : undefined,
      duration: 30
    })
  }

  function processNext () {
    const next = queueRef.current.shift()
    if (next) {
      setCurrent(next)
    } else {
      hasCurrentRef.current = false
      setCurrent(null)
    }
  }

  const onMsgRef = useRef(null)
  onMsgRef.current = function onMsg (e) {
    if (
      e &&
      e.data &&
      typeof e.data === 'string' &&
      e.data.includes('session-interactive')
    ) {
      const parsed = JSON.parse(e.data)
      if (hasCurrentRef.current) {
        queueRef.current.push(parsed)
      } else {
        hasCurrentRef.current = true
        setCurrent(parsed)
      }
    } else if (
      e &&
      e.data &&
      typeof e.data === 'string' &&
      e.data.includes('ssh-tunnel-result')
    ) {
      updateTab(JSON.parse(e.data))
    } else if (
      e &&
      e.data &&
      typeof e.data === 'string' &&
      e.data.includes('ssh-proxy-command-message')
    ) {
      notifyProxyCommandMessage(JSON.parse(e.data))
    }
  }

  function onSend (data) {
    window.et.commonWs.s(data)
  }

  const onClose = useCallback(() => {
    processNext()
  }, [])

  useEffect(() => {
    let cancelled = false
    function handler (e) {
      if (!cancelled) {
        onMsgRef.current(e)
      }
    }
    async function initWatch () {
      for (;;) {
        if (cancelled) {
          return
        }
        if (window.et.commonWs) {
          window.et.commonWs.addEventListener('message', handler)
          return
        }
        await wait(400)
      }
    }
    initWatch()
    return () => {
      cancelled = true
      if (window.et.commonWs) {
        window.et.commonWs.removeEventListener('message', handler)
      }
    }
  }, [])

  if (!current) {
    return null
  }

  return (
    <TermInteractiveUI
      opts={current}
      onSend={onSend}
      onClose={onClose}
    />
  )
}
