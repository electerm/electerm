/**
 * Reusable declarative-trigger editor.
 * Controlled component: props { value, onChange }.
 * Used by bookmark form tab, footer session modal and anywhere else.
 * Supports UI editing, JSON editing and built-in presets.
 */
import { useState } from 'react'
import {
  Button,
  Switch,
  Modal,
  Form,
  Input,
  Dropdown,
  Popconfirm,
  Empty,
  Tag,
  Tooltip,
  message
} from 'antd'
import {
  PlusOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  CodeOutlined,
  ThunderboltOutlined
} from '@ant-design/icons'
import TriggerForm from './trigger-form.jsx'
import {
  triggerPresets,
  buildTriggerFromPreset,
  buildEmptyTrigger
} from '../terminal/automation/trigger-presets.js'
import { validateTriggers } from '../terminal/automation/trigger-engine.js'
import uid from '../../common/uid'
import { te as e } from './trigger-lang.js'

function matchSummary (t) {
  const type = t.match?.type === 'regex' ? 're' : 'text'
  const v = t.match?.value || ''
  const short = v.length > 42 ? v.slice(0, 42) + '…' : v
  return `[${type}] ${short}`
}

function actionSummary (t) {
  if (t.action?.type === 'notify') {
    return 'notify'
  }
  const v = t.action?.value || ''
  const short = v.length > 24 ? v.slice(0, 24) + '…' : JSON.stringify(v)
  return `send ${short}${t.sendEnter === false ? '' : ' +⏎'}`
}

export default function TriggerEditor ({ value, onChange }) {
  const list = Array.isArray(value) ? value : []
  const [editing, setEditing] = useState(null)
  const [jsonOpen, setJsonOpen] = useState(false)
  const [jsonText, setJsonText] = useState('')
  const [form] = Form.useForm()

  const emit = (next) => {
    onChange?.(next)
  }

  const handleToggle = (id, enabled) => {
    emit(list.map(t => t.id === id ? { ...t, enabled } : t))
  }

  const handleDel = (id) => {
    emit(list.filter(t => t.id !== id))
  }

  const handleDuplicate = (item) => {
    const copy = { ...JSON.parse(JSON.stringify(item)), id: uid(), name: (item.name || '') + ' (copy)' }
    emit([...list, copy])
  }

  const openAdd = () => {
    setEditing(buildEmptyTrigger(uid))
  }

  const openEdit = (item) => {
    setEditing(JSON.parse(JSON.stringify(item)))
  }

  const handlePreset = ({ key }) => {
    const preset = triggerPresets[Number(key)]
    if (!preset) {
      return
    }
    emit([...list, buildTriggerFromPreset(preset, uid)])
    message.success('OK')
  }

  const handleSaveEdit = async () => {
    try {
      const v = await form.validateFields()
      const next = {
        ...(editing.id ? editing : {}),
        id: editing.id || uid(),
        name: v.name,
        enabled: v.enabled !== false,
        match: {
          type: v.matchType,
          value: v.matchValue,
          caseSensitive: !!v.caseSensitive
        },
        action: {
          type: v.actionType,
          value: v.actionType === 'notify' ? '' : (v.actionValue || '')
        },
        sendEnter: v.sendEnter !== false,
        mode: v.mode,
        cooldownMs: v.mode === 'cooldown' ? (v.cooldownMs == null ? 500 : v.cooldownMs) : 0
      }
      const errors = validateTriggers([next])
      if (errors.length) {
        message.error(errors[0])
        return
      }
      const exists = list.some(t => t.id === next.id)
      emit(exists ? list.map(t => t.id === next.id ? next : t) : [...list, next])
      setEditing(null)
    } catch (err) {
      // validation failed, keep modal open
    }
  }

  const openJson = () => {
    setJsonText(JSON.stringify(list, null, 2))
    setJsonOpen(true)
  }

  const applyJson = () => {
    let parsed
    try {
      parsed = JSON.parse(jsonText)
    } catch (err) {
      message.error('Invalid JSON: ' + err.message)
      return
    }
    if (!Array.isArray(parsed)) {
      message.error('JSON must be an array')
      return
    }
    const normalized = parsed.map(t => ({
      ...t,
      id: t.id || uid()
    }))
    const errors = validateTriggers(normalized)
    if (errors.length) {
      message.error(errors[0])
      return
    }
    emit(normalized)
    setJsonOpen(false)
    message.success('OK')
  }

  const presetMenu = {
    items: triggerPresets.map((p, i) => ({
      key: String(i),
      label: p.name
    })),
    onClick: handlePreset
  }

  return (
    <div className='trigger-editor'>
      <div className='pd1b' style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button
          size='small'
          type='primary'
          icon={<PlusOutlined />}
          onClick={openAdd}
        >
          {e('new')}
        </Button>
        <Dropdown menu={presetMenu} trigger={['click']}>
          <Button size='small' icon={<ThunderboltOutlined />}>
            {e('triggerPreset')}
          </Button>
        </Dropdown>
        <Button
          size='small'
          icon={<CodeOutlined />}
          onClick={openJson}
        >
          JSON
        </Button>
      </div>
      {
        !list.length
          ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={e('triggerEmpty')} />
          : list.map(t => (
            <div
              key={t.id}
              className='trigger-item pd1x pd1y mg1b'
              style={{ border: '1px solid var(--border, #333)', borderRadius: 4 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Switch
                  size='small'
                  checked={t.enabled !== false}
                  onChange={(v) => handleToggle(t.id, v)}
                />
                <b className='elli' style={{ flex: 1 }} title={t.name}>
                  {t.name || e('unnamed')}
                </b>
                <Tag>{t.mode || 'cooldown'}</Tag>
                <Tooltip title={e('edit')}>
                  <EditOutlined className='pointer' onClick={() => openEdit(t)} />
                </Tooltip>
                <Tooltip title={e('duplicate')}>
                  <CopyOutlined className='pointer' onClick={() => handleDuplicate(t)} />
                </Tooltip>
                <Popconfirm
                  title={e('del')}
                  onConfirm={() => handleDel(t.id)}
                >
                  <DeleteOutlined className='pointer' />
                </Popconfirm>
              </div>
              <div className='mg1t small muted elli' title={matchSummary(t) + ' → ' + actionSummary(t)}>
                {matchSummary(t)} → {actionSummary(t)}
              </div>
            </div>
          ))
      }
      <Modal
        open={!!editing}
        title={(editing?.name ? e('edit') : e('new')) + ' ' + e('trigger')}
        onCancel={() => setEditing(null)}
        onOk={handleSaveEdit}
        destroyOnHidden
        width={640}
      >
        {editing ? <TriggerForm form={form} initial={editing} /> : null}
      </Modal>
      <Modal
        open={jsonOpen}
        title='JSON'
        onCancel={() => setJsonOpen(false)}
        onOk={applyJson}
        destroyOnHidden
        width={640}
      >
        <Input.TextArea
          rows={14}
          value={jsonText}
          onChange={(ev) => setJsonText(ev.target.value)}
          spellCheck={false}
          style={{ fontFamily: 'monospace' }}
        />
        <div className='mg1t small muted'>
          {e('triggerJsonHint')}
        </div>
      </Modal>
    </div>
  )
}
