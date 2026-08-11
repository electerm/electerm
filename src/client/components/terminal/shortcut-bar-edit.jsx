/**
 * edit modal for the shortcut bar.
 *
 * - tap a candidate to append it to the active list (order = click order)
 * - tap the × on an active item to remove it
 * - build a custom button (label + literal text to send)
 * - search filters the candidate library
 *
 * Rendered through a portal to document.body so it isn't trapped inside the
 * bar's (z-index 400, 44px tall) stacking context — otherwise higher-z app
 * layers would paint over it on mobile.
 */

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Input } from 'antd'
import {
  CloseOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined
} from '@ant-design/icons'
import classnames from 'classnames'
import Modal from '../common/modal'
import { defaultActive } from './shortcut-bar-defs'

const e = window.translate

export default function ShortcutBarEdit (props) {
  const {
    active,
    candidates: allCandidates,
    isMobile,
    onCancel,
    onSave
  } = props

  const [draft, setDraft] = useState(() => active.map(b => ({ ...b })))
  const [keyword, setKeyword] = useState('')
  const [customLabel, setCustomLabel] = useState('')
  const [customData, setCustomData] = useState('')

  const activeIds = new Set(draft.map(b => b.id))

  function handleAddCandidate (btn) {
    if (activeIds.has(btn.id)) {
      return
    }
    setDraft(prev => [...prev, { ...btn }])
  }

  function handleRemoveActive (id) {
    setDraft(prev => prev.filter(b => b.id !== id))
  }

  function handleAddCustom () {
    const label = customLabel.trim()
    const data = customData
    if (!label) {
      return
    }
    const id = 'custom-' + label + '-' + Date.now()
    setDraft(prev => [...prev, { id, label, data, custom: true }])
    setCustomLabel('')
    setCustomData('')
  }

  function handleReset () {
    setDraft(defaultActive())
  }

  function handleSave () {
    onSave(draft)
  }

  const kw = keyword.trim().toLowerCase()
  const filtered = allCandidates.filter(b => {
    if (!kw) {
      return true
    }
    return b.label.toLowerCase().includes(kw) || b.id.includes(kw)
  })

  function renderActive (b) {
    return (
      <div
        key={b.id}
        className='shortcut-active-item'
      >
        <span className='shortcut-active-label'>{b.label}</span>
        <button
          type='button'
          className='shortcut-active-remove'
          onClick={() => handleRemoveActive(b.id)}
        >
          <CloseOutlined />
        </button>
      </div>
    )
  }

  function renderCandidate (b) {
    const added = activeIds.has(b.id)
    return (
      <button
        type='button'
        key={b.id}
        className={classnames('shortcut-candidate-item', { added })}
        onClick={() => handleAddCandidate(b)}
      >
        {b.label}
      </button>
    )
  }

  const footer = (
    <div className='custom-modal-footer-buttons shortcut-edit-footer'>
      <button
        type='button'
        className='custom-modal-cancel-btn'
        onClick={handleReset}
      >
        <ReloadOutlined /> {e('reset')}
      </button>
      <button
        type='button'
        className='custom-modal-cancel-btn'
        onClick={onCancel}
      >
        {e('cancel')}
      </button>
      <button
        type='button'
        className='custom-modal-ok-btn'
        onClick={handleSave}
      >
        {e('save')}
      </button>
    </div>
  )
  const sst = e('keyboardShortcuts')
  return createPortal(
    <Modal
      open
      title={e('edit')}
      onCancel={onCancel}
      footer={footer}
      width={560}
      zIndex={1100}
      wrapClassName={classnames('shortcut-edit-wrap', { 'is-mobile': isMobile })}
    >
      <div className='shortcut-edit-section'>
        <div className='shortcut-edit-section-title'>{sst}</div>
        <div className='shortcut-active-list'>
          {draft.length === 0 && (
            <div className='shortcut-active-empty'>0 {sst}</div>
          )}
          {draft.map(renderActive)}
        </div>
      </div>

      <div className='shortcut-edit-section'>
        <div className='shortcut-custom-form'>
          <Input
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={ev => setKeyword(ev.target.value)}
            placeholder={e('search')}
            className='shortcut-search-input'
            allowClear
          />
        </div>
        <div className='shortcut-candidate-list'>
          {filtered.map(renderCandidate)}
        </div>
      </div>

      <div className='shortcut-edit-section'>
        <div className='shortcut-edit-section-title'>+ {sst}</div>
        <div className='shortcut-custom-form'>
          <Input
            value={customLabel}
            onChange={ev => setCustomLabel(ev.target.value)}
            placeholder={e('label')}
            className='shortcut-custom-input'
          />
          <Input
            value={customData}
            onChange={ev => setCustomData(ev.target.value)}
            placeholder={e('edit')}
            className='shortcut-custom-input'
          />
          <button
            type='button'
            className='custom-modal-ok-btn shortcut-custom-add'
            onClick={handleAddCustom}
          >
            <PlusOutlined /> {e('add')}
          </button>
        </div>
      </div>
    </Modal>,
    document.body
  )
}
