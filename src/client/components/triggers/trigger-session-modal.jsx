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
import message from '../common/message'

const e = window.translate

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
            {t.name || 'Unnamed'}
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
            {t.name || 'Unnamed'}
          </b>
          {
            overridden && overrides[t.id] !== globalOn
              ? (
                <span className='small muted'>
                  {globalOn ? 'global: on' : 'global: off'}
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
          message='All predefined triggers. Switches change the global on/off default.'
        />
        {
          !predefined.length
            ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description='No triggers yet — add one in Manage' />
            : predefined.map(renderGlobalRow)
        }
        <div className='pd1t' style={{ textAlign: 'right' }}>
          <Button
            size='small'
            icon={<SettingOutlined />}
            onClick={openManage}
          >
            e('edit')
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
                <b>Predefined</b>
                <span className='small muted mg1l'>Switches apply to this session only.</span>
                <div className='pd1t'>
                  {predefined.map(renderSessionRow)}
                </div>
              </div>
              )
        }
        <div className='mg1b'>
          <b>This session</b>
          <span className='small muted mg1l'>Temporary rules are not saved to the triggers database.</span>
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
      label: `${e('global')} (${predefined.length})`,
      children: renderGlobalList()
    },
    {
      key: 'session',
      label: `This session (${activeCount})`,
      children: renderSessionList()
    }
  ]

  return (
    <Modal
      open={open}
      title={e('triggers')}
      onCancel={handleClose}
      footer={null}
      width={680}
    >
      <Tabs items={items} />
    </Modal>
  )
})
