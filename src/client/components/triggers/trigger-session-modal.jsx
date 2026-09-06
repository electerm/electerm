/**
 * Trigger popup opened from the footer icon.
 * Tab 1: predefined (global/db) triggers — toggle on/off for this session.
 * Tab 2: session temp rules — free editing, memory only, never persisted.
 * Predefined trigger management (create/edit) lives in the settings panel.
 */
import { auto } from 'manate/react'
import { Modal, Tabs, Alert, Switch, Button, Empty, Tag } from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import TriggerEditor, { matchSummary, actionSummary } from './trigger-editor.jsx'
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
  const predefined = store.triggers || []
  const overrides = (tab && tab.triggerOverrides) || {}

  const handleSessionChange = (next) => {
    const errors = store.setSessionTriggers(tabId, next)
    if (errors && errors.length) {
      message.error(errors[0])
    }
  }

  const handleClose = () => {
    store.toggleTriggerSessionModal(false)
  }

  const openManage = () => {
    store.toggleTriggerSessionModal(false)
    store.openTriggers()
  }

  const renderPredefined = () => {
    if (!predefined.length) {
      return (
        <div>
          <Alert
            type='info'
            showIcon
            className='mg1b'
            message={e('triggerPredefinedHint')}
          />
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={e('triggerEmpty')}
          />
          <div className='pd1t' style={{ textAlign: 'center' }}>
            <Button
              size='small'
              icon={<SettingOutlined />}
              onClick={openManage}
            >
              {e('triggerManage')}
            </Button>
          </div>
        </div>
      )
    }
    return (
      <div>
        <Alert
          type='info'
          showIcon
          className='mg1b'
          message={e('triggerPredefinedHint')}
        />
        {
          predefined.map(t => {
            const checked = t.id in overrides
              ? overrides[t.id]
              : t.enabled !== false
            return (
              <div
                key={t.id}
                className='trigger-item pd1x pd1y mg1b'
                style={{ border: '1px solid var(--border, #333)', borderRadius: 4 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Switch
                    size='small'
                    checked={checked}
                    onChange={v => store.togglePredefinedTrigger(tabId, t.id, v)}
                  />
                  <b className='elli' style={{ flex: 1 }} title={t.name}>
                    {t.name || e('unnamed')}
                  </b>
                  <Tag>{t.mode || 'cooldown'}</Tag>
                </div>
                <div className='mg1t small muted elli' title={matchSummary(t) + ' → ' + actionSummary(t)}>
                  {matchSummary(t)} → {actionSummary(t)}
                </div>
              </div>
            )
          })
        }
        <div className='pd1t' style={{ textAlign: 'right' }}>
          <Button
            size='small'
            icon={<SettingOutlined />}
            onClick={openManage}
          >
            {e('triggerManage')}
          </Button>
        </div>
      </div>
    )
  }

  const items = [
    {
      key: 'predefined',
      label: `${e('triggerGlobal')} (${predefined.length})`,
      children: renderPredefined()
    },
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
