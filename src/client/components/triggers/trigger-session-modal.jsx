/**
 * Trigger popup opened from the footer icon.
 * Global tab: all predefined triggers, switches change the global on/off
 * default (persisted in db, synced).
 * This-session tab: ALL triggers (predefined + session temp/bookmark rules)
 * with session-only switches (memory, per tab), plus a temp rule editor.
 * Predefined trigger management (create/edit) lives in the settings panel.
 */
import { auto } from 'manate/react'
import { Modal, Tabs, Alert, Switch, Button, Empty, Tag } from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import TriggerEditor, { matchSummary, actionSummary } from './trigger-editor.jsx'
import { te as e } from './trigger-lang.js'
import message from '../common/message'

function renderItemWrap (children) {
  return (
    <div
      className='trigger-item pd1x pd1y mg1b'
      style={{ border: '1px solid var(--border, #333)', borderRadius: 4 }}
    >
      {children}
    </div>
  )
}

function renderMeta (t) {
  return (
    <div className='mg1t small muted elli' title={matchSummary(t) + ' → ' + actionSummary(t)}>
      {matchSummary(t)} → {actionSummary(t)}
    </div>
  )
}

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

  // global tab: switch = global on/off default (persisted)
  const renderGlobalRow = (t) => {
    return renderItemWrap(
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Switch
            size='small'
            checked={t.enabled !== false}
            onChange={v => store.editTrigger(t.id, { enabled: v })}
          />
          <b className='elli' style={{ flex: 1 }} title={t.name}>
            {t.name || e('unnamed')}
          </b>
          <Tag>{t.mode || 'cooldown'}</Tag>
        </div>
        {renderMeta(t)}
      </div>
    )
  }

  // session tab: switch = on/off for this session only (memory)
  const renderSessionRow = (t) => {
    const globalOn = t.enabled !== false
    const overridden = t.id in overrides
    const checked = overridden ? overrides[t.id] : globalOn
    return renderItemWrap(
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Switch
            size='small'
            checked={checked}
            onChange={v => store.togglePredefinedTrigger(tabId, t.id, v)}
          />
          <b className='elli' style={{ flex: 1 }} title={t.name}>
            {t.name || e('unnamed')}
          </b>
          {
            overridden && overrides[t.id] !== globalOn
              ? (
                <span className='small muted'>
                  {globalOn ? e('triggerGlobalOn') : e('triggerGlobalOff')}
                </span>
                )
              : null
          }
          <Tag>{t.mode || 'cooldown'}</Tag>
        </div>
        {renderMeta(t)}
      </div>
    )
  }

  const renderGlobalList = () => {
    return (
      <div>
        <Alert
          type='info'
          showIcon
          className='mg1b'
          message={e('triggerGlobalHint')}
        />
        {
          !predefined.length
            ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={e('triggerEmpty')} />
            : predefined.map(renderGlobalRow)
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

  const renderSessionList = () => {
    return (
      <div>
        {
          !predefined.length
            ? null
            : (
              <div className='mg1b'>
                <b>{e('triggerPredefined')}</b>
                <span className='small muted mg1l'>{e('triggerPredefinedHint')}</span>
                <div className='pd1t'>
                  {predefined.map(renderSessionRow)}
                </div>
              </div>
              )
        }
        <div className='mg1b'>
          <b>{e('triggerSession')}</b>
          <span className='small muted mg1l'>{e('triggerSessionHint')}</span>
        </div>
        <TriggerEditor
          value={sessionTriggers}
          onChange={handleSessionChange}
        />
      </div>
    )
  }

  const activeCount = tab
    ? store.getEffectiveTriggers(tab).length
    : predefined.filter(t => t.enabled !== false).length

  const items = [
    {
      key: 'predefined',
      label: `${e('triggerGlobal')} (${predefined.length})`,
      children: renderGlobalList()
    },
    {
      key: 'session',
      label: `${e('triggerSession')} (${activeCount})`,
      children: renderSessionList()
    }
  ]

  return (
    <Modal
      open={open}
      title={e('trigger')}
      onCancel={handleClose}
      footer={null}
      width={680}
    >
      <Tabs items={items} />
    </Modal>
  )
})
