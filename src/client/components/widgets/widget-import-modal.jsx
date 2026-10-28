/**
 * Import a widget: from a git repository, or from a folder on this computer.
 *
 * The repository form is the one worth explaining, because the folder name in a
 * repo has nothing to do with the id the widget is installed under — the
 * manifest decides that — and a monorepo has to be pointed at the folder that
 * holds one. So the accepted shapes are spelled out under the input instead of
 * leaving the user to guess.
 *
 * Errors stay in the modal, next to the input that caused them: a toast would
 * disappear while the user is still looking at the field they have to fix.
 *
 * Styling is the app's own — `cwf-desc`, `font12`, `Alert`, and the shared
 * footer button row — so this modal looks like the widget form it sits next to
 * without a stylesheet of its own.
 */
import React, { useState } from 'react'
import { Alert, Button, Input } from 'antd'
import { FolderOpenOutlined } from '@ant-design/icons'
import Modal from '../common/modal'

const e = window.translate

export default function WidgetImportModal ({ open, onCancel, onImport, onChooseFolder }) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const close = () => {
    if (busy) {
      return
    }
    setError('')
    onCancel()
  }

  const submit = async () => {
    const input = value.trim()
    if (!input) {
      setError('Give a repository, like owner/repo or https://github.com/owner/repo')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onImport(input)
      setValue('')
    } catch (err) {
      console.error('import widget error', err)
      setError((err && err.message) || String(err))
    } finally {
      setBusy(false)
    }
  }

  const footer = (
    <div className='custom-modal-footer-buttons'>
      <Button
        icon={<FolderOpenOutlined />}
        disabled={busy}
        onClick={onChooseFolder}
      >
        {e('import')} folder
      </Button>
      <Button
        disabled={busy}
        onClick={close}
      >
        {e('cancel')}
      </Button>
      <Button
        type='primary'
        loading={busy}
        onClick={submit}
      >
        {e('import')}
      </Button>
    </div>
  )

  return (
    <Modal
      open={open}
      title={e('import') + ' widget'}
      width={480}
      onCancel={close}
      footer={footer}
    >
      <p className='cwf-desc'>
        Paste a GitHub or AtomGit repository, or a link to a folder inside one.
        The widget is copied into electerm's data folder; nothing runs until you
        open it.
      </p>
      <Input
        autoFocus
        value={value}
        disabled={busy}
        placeholder='owner/repo or https://github.com/owner/repo'
        onChange={ev => setValue(ev.target.value)}
        onPressEnter={submit}
      />
      <div className='font12 mg1t'>
        owner/repo · owner/repo#branch · owner/repo/sub/folder · a github.com or atomgit.com link
      </div>
      {error && (
        <Alert
          className='mg1t'
          type='error'
          showIcon
          title={error}
        />
      )}
    </Modal>
  )
}
