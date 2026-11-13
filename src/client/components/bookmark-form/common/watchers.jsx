/**
 * Bookmark watcher editor.
 * Controlled component: props { value, onChange }, so it works as an antd Form
 * field (see ./watchers-field.jsx) exactly like the trigger editor does.
 *
 * A watcher belongs to the bookmark: it is copied onto the tab when the session
 * starts, and shown in the monitor bar / info panel of that session only.
 */
import { useState } from 'react'
import { Button, Empty, Input, InputNumber, Modal, Popconfirm, Switch, Tag } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import {
  DEFAULT_WATCHER_INTERVAL,
  MAX_WATCHER_INTERVAL,
  MIN_WATCHER_INTERVAL,
  normalizeWatcher,
  normalizeWatchers,
  normalizeWatcherInterval,
  parseWatcherCommand,
  watcherName
} from '../../../common/custom-watcher'
import uid from '../../../common/uid'
import './watchers.styl'

const e = window.translate

function emptyWatcher () {
  return {
    id: uid(),
    name: '',
    command: '',
    interval: DEFAULT_WATCHER_INTERVAL,
    enabled: true
  }
}

function rowClassName (watcher) {
  if (watcher.enabled) {
    return 'watcher-row'
  }
  return 'watcher-row watcher-row-off'
}

// Rewrite one entry in place, keeping the order the user arranged.
function replaceWatcher (list, id, make) {
  return list.map(item => {
    if (item.id !== id) {
      return item
    }
    return make(item)
  })
}

function upsertWatcher (list, watcher) {
  const exists = list.some(item => item.id === watcher.id)
  if (!exists) {
    return [...list, watcher]
  }
  return replaceWatcher(list, watcher.id, () => watcher)
}

function removeWatcher (list, id) {
  return list.filter(item => item.id !== id)
}

function modalTitle (list, editing) {
  if (!editing) {
    return `${e('new')} watcher`
  }
  const exists = list.some(item => item.id === editing.id)
  if (!exists) {
    return `${e('new')} watcher`
  }
  return `${e('edit')} watcher`
}

function WatcherRow ({ watcher, onEdit, onDelete, onToggle }) {
  return (
    <div className={rowClassName(watcher)} data-watcher-id={watcher.id}>
      <div className='watcher-row-head'>
        <Switch
          checked={watcher.enabled}
          onChange={checked => onToggle(watcher.id, checked)}
          size='small'
        />
        <b className='watcher-row-name' title={watcher.name}>{watcher.name}</b>
        <Tag className='watcher-row-interval'>{watcher.interval}s</Tag>
        <span className='watcher-row-actions'>
          <Button
            aria-label={e('edit')}
            icon={<EditOutlined />}
            onClick={() => onEdit(watcher)}
            size='small'
            title={e('edit')}
            type='text'
          />
          <Popconfirm
            onConfirm={() => onDelete(watcher.id)}
            title={`${e('delete')} ${watcher.name}?`}
          >
            <Button
              aria-label={`${e('delete')} ${watcher.name}`}
              icon={<DeleteOutlined />}
              size='small'
              type='text'
            />
          </Popconfirm>
        </span>
      </div>
      <code className='watcher-row-command' title={watcher.command}>{watcher.command}</code>
    </div>
  )
}

function WatcherList ({ watchers, onEdit, onDelete, onToggle }) {
  if (!watchers.length) {
    return (
      <Empty
        description='No watcher yet — add a command to poll while this session is open'
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    )
  }
  return watchers.map(watcher => (
    <WatcherRow
      key={watcher.id}
      onDelete={onDelete}
      onEdit={onEdit}
      onToggle={onToggle}
      watcher={watcher}
    />
  ))
}

// Shown once a wrapper was recognised, so it is obvious what will really run.
function DetectedCommand ({ parsed }) {
  if (!parsed.interval) {
    return (
      <div className='watcher-form-detected'>
        Runs as: <code>{parsed.command}</code>
      </div>
    )
  }
  return (
    <div className='watcher-form-detected'>
      Runs as: <code>{parsed.command}</code>, every {parsed.interval}s
    </div>
  )
}

// The `watch -n` value follows the typed command until the interval is set by
// hand; after that the field wins.
function effectiveInterval (touched, parsed, fallback) {
  if (touched || parsed.interval === null) {
    return fallback
  }
  return parsed.interval
}

function WatcherForm ({ initial, onSubmit, onCancel }) {
  const [name, setName] = useState(initial.name || '')
  const [command, setCommand] = useState(initial.command || '')
  const [interval, setInterval] = useState(initial.interval || DEFAULT_WATCHER_INTERVAL)
  const [intervalTouched, setIntervalTouched] = useState(false)
  const parsed = parseWatcherCommand(command)
  const intervalValue = effectiveInterval(intervalTouched, parsed, interval)
  const unwrapped = parsed.command !== command.trim()

  const submit = () => {
    if (!command.trim()) {
      return
    }
    onSubmit(normalizeWatcher({
      ...initial,
      name: watcherName(name, parsed.command),
      command: parsed.command,
      interval: normalizeWatcherInterval(intervalValue)
    }))
  }

  return (
    <div className='watcher-form'>
      <div className='watcher-form-row'>
        <label htmlFor='watcher-form-name'>{e('name')}</label>
        <Input
          id='watcher-form-name'
          onChange={event => setName(event.target.value)}
          placeholder='e.g. GPU 0'
          size='small'
          value={name}
        />
      </div>
      <div className='watcher-form-row watcher-form-row-interval'>
        <label htmlFor='watcher-form-interval'>Interval (s)</label>
        <InputNumber
          id='watcher-form-interval'
          max={MAX_WATCHER_INTERVAL}
          min={MIN_WATCHER_INTERVAL}
          onChange={value => {
            setIntervalTouched(true)
            setInterval(normalizeWatcherInterval(value))
          }}
          size='small'
          value={intervalValue}
        />
      </div>
      <div className='watcher-form-row watcher-form-row-command'>
        <label htmlFor='watcher-form-command'>{e('command')}</label>
        <Input.TextArea
          autoSize={{ minRows: 2, maxRows: 6 }}
          id='watcher-form-command'
          onChange={event => setCommand(event.target.value)}
          placeholder='nvidia-smi -i 0'
          spellCheck={false}
          value={command}
        />
        {unwrapped && <DetectedCommand parsed={parsed} />}
      </div>
      <div className='watcher-form-hint'>
        The command runs over the session's command channel, which has no
        terminal: <code>watch</code> and <code>while true; do ...; sleep N; done</code>{' '}
        are unwrapped automatically and the interval above drives the refresh.
      </div>
      <div className='watcher-form-actions'>
        <Button onClick={onCancel} size='small'>{e('cancel')}</Button>
        <Button disabled={!command.trim()} onClick={submit} size='small' type='primary'>
          {e('save')}
        </Button>
      </div>
    </div>
  )
}

export default function WatcherEditor ({ value, onChange }) {
  const list = normalizeWatchers(value)
  const [editing, setEditing] = useState(null)

  const emit = next => onChange?.(next)
  const openAdd = () => setEditing(emptyWatcher())
  const openEdit = watcher => setEditing({ ...watcher })
  const close = () => setEditing(null)

  const handleSave = watcher => {
    if (!watcher) {
      return
    }
    emit(upsertWatcher(list, watcher))
    close()
  }

  const handleDelete = id => emit(removeWatcher(list, id))

  const handleToggle = (id, enabled) => emit(replaceWatcher(
    list,
    id,
    item => ({ ...item, enabled })
  ))

  return (
    <div className='watcher-editor'>
      <div className='watcher-editor-toolbar'>
        <Button icon={<PlusOutlined />} onClick={openAdd} size='small' type='primary'>
          {e('new')}
        </Button>
      </div>
      <WatcherList
        onDelete={handleDelete}
        onEdit={openEdit}
        onToggle={handleToggle}
        watchers={list}
      />
      <Modal
        destroyOnHidden
        footer={null}
        onCancel={close}
        open={!!editing}
        title={modalTitle(list, editing)}
        width={520}
      >
        {editing && (
          <WatcherForm
            initial={editing}
            onCancel={close}
            onSubmit={handleSave}
          />
        )}
      </Modal>
    </div>
  )
}
