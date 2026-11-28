import { useLayoutEffect } from 'react'
import { Checkbox, Modal } from 'antd'
import { refsStatic } from '../common/ref'
import { agentPermissionLabel } from './agent-permissions'

const refKey = 'agentApproval'
const e = window.translate

// Keep shell text readable while exposing control characters that could
// change what the terminal receives or reorder what the reviewer sees.
function visibleText (text) {
  return text.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, ch =>
    ch === '\n' ? ch : `\\u{${ch.codePointAt(0).toString(16)}}`
  )
}

function redactCredential (key, value) {
  if (typeof value !== 'string') return value
  if (/^(password|passphrase|privateKey|certificate|apiKey|accessToken|token|secret)$/i.test(key)) {
    return '••••'
  }
  if (key === 'url' || key === 'proxy') {
    return value.replace(/(:\/\/[^/@]*:)[^/@]+@/, '$1••••@')
  }
  return value
}

function ApprovalDetails ({ name, args, allowRemember, onRemember }) {
  const { command, ...rest } = args
  const hasCommand = typeof command === 'string'
  const details = hasCommand ? rest : args
  const target = name === 'open_bookmark'
    ? window.store.bookmarks.find(b => b.id === args.id)
    : args.tabId && window.store.tabs.find(t => t.id === args.tabId)
  const destination = target && [target.title, target.host].filter(Boolean).join(' · ')
  return (
    <>
      <p><code>{visibleText(name)}</code></p>
      {destination && <p className='wordbreak'>{visibleText(destination)}</p>}
      {hasCommand && (
        <>
          <div>{e('command')}</div>
          <pre className='agent-tool-pre'>{visibleText(command)}</pre>
        </>
      )}
      {Object.keys(details).length > 0 && (
        <pre className='agent-tool-pre mg1t'>{visibleText(JSON.stringify(details, redactCredential, 2))}</pre>
      )}
      {allowRemember && (
        <Checkbox className='mg1t' onChange={evt => onRemember(evt.target.checked)}>
          {agentPermissionLabel('agentAlwaysAllowCommand', 'Always allow this exact command in all terminals')}
        </Checkbox>
      )}
    </>
  )
}

export function requestAgentApproval (request) {
  const confirm = refsStatic.get(refKey)
  return confirm ? confirm(request) : Promise.resolve('deny')
}

export function AgentApproval () {
  const [modal, contextHolder] = Modal.useModal()
  useLayoutEffect(() => {
    let dismissPending
    refsStatic.add(refKey, ({ name, args, allowRemember, signal }) => new Promise(resolve => {
      dismissPending?.()
      if (signal?.aborted) {
        resolve('deny')
        return
      }
      let remember = false
      function finish (answer) {
        signal?.removeEventListener('abort', dismiss)
        if (dismissPending === dismiss) dismissPending = null
        resolve(answer)
      }
      function dismiss () {
        finish('deny')
        dialog.destroy()
      }
      const dialog = modal.confirm({
        className: 'agent-approval-modal',
        title: `Agent · ${e('permission')}`,
        content: (
          <ApprovalDetails
            name={name}
            args={args}
            allowRemember={allowRemember}
            onRemember={checked => { remember = checked }}
          />
        ),
        width: 520,
        okText: e('ok'),
        cancelText: e('cancel'),
        focusable: { autoFocusButton: 'cancel' },
        onOk: () => finish(remember ? 'remember' : 'once'),
        onCancel: () => finish('deny'),
        afterClose: () => finish('deny')
      })
      dismissPending = dismiss
      signal?.addEventListener('abort', dismiss)
    }))
    return () => {
      refsStatic.remove(refKey)
      dismissPending?.()
    }
  }, [modal])
  return contextHolder
}
