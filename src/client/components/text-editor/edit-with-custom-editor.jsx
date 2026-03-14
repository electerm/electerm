/**
 * Edit with custom editor - input + button component
 */

import { useState } from 'react'
import { Button, Input, Space } from 'antd'

const LS_KEY = 'customEditorCommand'
const e = window.translate

export default function EditWithCustomEditor ({ loading, editWithCustom }) {
  const [editorCommand, setEditorCommand] = useState(
    () => window.localStorage.getItem(LS_KEY) || ''
  )

  function handleChange (ev) {
    const val = ev.target.value
    setEditorCommand(val)
    window.localStorage.setItem(LS_KEY, val)
  }

  function handleClick () {
    const cmd = editorCommand.trim()
    if (cmd) {
      editWithCustom(cmd)
    }
  }

  if (window.et.isWebApp) {
    return null
  }

  return (
    <Space.Compact className='mg1b'>
      <Button
        type='primary'
        disabled={loading || !editorCommand.trim()}
        onClick={handleClick}
      >
        {e('editWith')}
      </Button>
      <Input
        value={editorCommand}
        onChange={handleChange}
        disabled={loading}
      />
    </Space.Compact>
  )
}
