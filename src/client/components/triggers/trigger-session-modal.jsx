/**
 * Session/global trigger editing popup opened from the footer icon.
 * Reuses TriggerEditor for both scopes.
 */
import { auto } from 'manate/react'
import { Modal, Tabs, Alert } from 'antd'
import TriggerEditor from './trigger-editor.jsx'
import { te as e } from './trigger-lang.js'
import message from '../common/message'

export default auto(function TriggerSessionModal (props) {
  const { store } = props
  const open = !!store.triggerSessionOpen
  if (!open) {
    return null
  }
  const tab = store.currentTab
  const tabId = tab?.id || store.activeTabId
  const sessionTriggers = (tab && tab.triggers) || []
  const globalTriggers = store.triggers || []

  const handleSessionChange = (next) => {
    const errors = store.setSessionTriggers(tabId, next)
    if (errors && errors.length) {
      message.error(errors[0])
    }
  }

  const handleGlobalChange = (next) => {
    const errors = store.setTriggers(next)
    if (errors && errors.length) {
      message.error(errors[0])
    }
  }

  const handleClose = () => {
    store.toggleTriggerSessionModal(false)
  }

  const items = [
    {
      key: 'session',
      label: `${e('triggerSession')} (${sessionTriggers.length})`,
      children: (
        <div>
          <Alert
            type='info'
            showIcon
            className='mg1b'
            message={e('triggerSessionHint')}
          />
          <TriggerEditor
            value={sessionTriggers}
            onChange={handleSessionChange}
          />
        </div>
      )
    },
    {
      key: 'global',
      label: `${e('triggerGlobal')} (${globalTriggers.length})`,
      children: (
        <div>
          <Alert
            type='info'
            showIcon
            className='mg1b'
            message={e('triggerGlobalHint')}
          />
          <TriggerEditor
            value={globalTriggers}
            onChange={handleGlobalChange}
          />
        </div>
      )
    }
  ]

  return (
    <Modal
      open={open}
      title={e('trigger')}
      onCancel={handleClose}
      footer={null}
      width={680}
      destroyOnHidden
    >
      <Tabs items={items} />
    </Modal>
  )
})
