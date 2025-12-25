/**
 * Workspace save modal component - standalone modal
 */

import React, { useState } from 'react'
import { auto } from 'manate/react'
import { Modal, Input, Select, Button, Space, message, Radio } from 'antd'
import { SaveOutlined, EditOutlined } from '@ant-design/icons'

const e = window.translate

export default auto(function WorkspaceSaveModal ({ store }) {
  const { workspaceSaveModalVisible, workspaces } = store
  const [name, setName] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [saveMode, setSaveMode] = useState('new') // 'new' or 'overwrite'

  if (!workspaceSaveModalVisible) {
    return null
  }

  function handleClose () {
    window.store.workspaceSaveModalVisible = false
  }

  function handleSave () {
    if (saveMode === 'new') {
      if (!name.trim()) {
        message.error(e('name needed'))
        return
      }
      window.store.saveWorkspace(name.trim())
      message.success(e('saved'))
    } else {
      if (!selectedId) {
        message.error('please Select Workspace')
        return
      }
      const ws = workspaces.find(w => w.id === selectedId)
      window.store.saveWorkspace(ws?.name || name, selectedId)
      message.success(e('saved'))
    }
    setName('')
    setSelectedId(null)
    setSaveMode('new')
    handleClose()
  }

  function handleCancel () {
    setName('')
    setSelectedId(null)
    setSaveMode('new')
    handleClose()
  }

  const options = workspaces.map(w => ({
    label: w.name,
    value: w.id
  }))

  return (
    <Modal
      title={e('save')}
      open={workspaceSaveModalVisible}
      onCancel={handleCancel}
      footer={null}
      width={400}
    >
      <div className='pd1y'>
        <Space direction='vertical' block>
          <Radio.Group
            value={saveMode}
            onChange={ev => setSaveMode(ev.target.value)}
          >
            <Radio value='new'>
              <SaveOutlined className='mg1r' />
              {e('saveAsNew')}
            </Radio>
            <Radio value='overwrite' disabled={!workspaces.length}>
              <EditOutlined className='mg1r' />
              {e('overwrite')}
            </Radio>
          </Radio.Group>

          {saveMode === 'new'
            ? (
              <Input
                placeholder={e('name')}
                value={name}
                onChange={e => setName(e.target.value)}
                onPressEnter={handleSave}
              />
              )
            : (
              <Select
                placeholder={e('workspaces')}
                value={selectedId}
                onChange={setSelectedId}
                options={options}
                style={{ width: '100%' }}
              />
              )}

          <div className='pd1t'>
            <Button type='primary' onClick={handleSave}>
              {e('save')}
            </Button>
            <Button className='mg1l' onClick={handleCancel}>
              {e('cancel')}
            </Button>
          </div>
        </Space>
      </div>
    </Modal>
  )
})
