/**
 * handle terminal interactive operation - queue based
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import wait from '../../common/wait'
import TermInteractiveUI from './terminal-interactive-ui'
import ExternalLink from '../common/external-link.jsx'
import { notification } from '../common/notification'
import {
  markNeedsInteractiveInput,
  clearNeedsInteractiveInput
} from './interactive-prompt-state.js'

// x11 warnings already shown, keyed by message text
const shownX11Warnings = new Set()

// A prompt is only answerable while the tab it was asked for still exists:
// reloadTab mints a new tab id, so a prompt left over from a previous attempt
// names a tab that is already gone.
function isLiveTab (tabId) {
  if (!tabId) {
    return true
  }
  const tabs = window.store?.tabs || []
  return tabs.some(t => t.id === tabId)
}

export default function TermInteractive () {
  const [current, setCurrent] = useState(null)
  const queueRef = useRef([])
  const hasCurrentRef = useRef(false)
  const currentIdRef = useRef(null)

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

  function notifyX11Warning (data) {
    // one notification per distinct message, several tabs may report it
    if (shownX11Warnings.has(data.message)) {
      return
    }
    shownX11Warnings.add(data.message)
    notification.warning({
      message: 'X11 forwarding',
      description: (
        <div className='pd0 mg0'>
          <div>{data.message}</div>
          {
            data.url
              ? <ExternalLink to={data.url}>{data.url}</ExternalLink>
              : null
          }
        </div>
      ),
      duration: 30
    })
  }

  function processNext () {
    const next = queueRef.current.shift()
    if (next) {
      showPrompt(next)
    } else {
      hasCurrentRef.current = false
      currentIdRef.current = null
      setCurrent(null)
    }
  }

  // `current` only updates on the next render, so the id has to be tracked
  // separately: two prompts can be taken back in the same tick, and the second
  // close would otherwise compare against the prompt that was already dropped.
  function showPrompt (prompt) {
    hasCurrentRef.current = !!prompt
    currentIdRef.current = prompt ? prompt.id : null
    setCurrent(prompt)
  }

  // The server takes a prompt back when the attempt that asked for it dies
  // (handshake timeout, dropped connection, internal retry). Drop it here too,
  // otherwise the dialog outlives its connection and blocks the window.
  function dropPrompt (id) {
    if (currentIdRef.current === id) {
      processNext()
      return
    }
    queueRef.current = queueRef.current.filter(d => d.id !== id)
  }

  function onPrompt (parsed) {
    if (!isLiveTab(parsed.tabId)) {
      // the tab it was asked for is gone: answer "cancel" so the server side
      // stops waiting, and never show it
      window.et.commonWs?.s({
        id: parsed.id,
        results: []
      })
      return
    }
    if (hasCurrentRef.current) {
      queueRef.current.push(parsed)
    } else {
      showPrompt(parsed)
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
      // must be tested first: the close action also contains this substring
      if (parsed.action === 'session-interactive-close') {
        markNeedsInteractiveInput(parsed.tabId)
        dropPrompt(parsed.id)
        return
      }
      onPrompt(parsed)
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
    } else if (
      e &&
      e.data &&
      typeof e.data === 'string' &&
      e.data.includes('x11-warning')
    ) {
      notifyX11Warning(JSON.parse(e.data))
    }
  }

  function onSend (data) {
    // An answer means the session can still be revived on its own; an empty
    // answer is the cancel button, and then no retry may re-ask on the user's
    // behalf (see interactive-prompt-state.js).
    if (Array.isArray(data.results) && data.results.length) {
      clearNeedsInteractiveInput(current?.tabId)
    } else {
      markNeedsInteractiveInput(current?.tabId)
    }
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
