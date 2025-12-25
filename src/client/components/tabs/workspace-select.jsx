/**
 * Workspace select content component
 */

import React from 'react'
import { Button, Empty, Popconfirm } from 'antd'
import {
  SaveOutlined,
  DeleteOutlined
} from '@ant-design/icons'
import { auto } from 'manate/react'

const e = window.translate

export default auto(function WorkspaceSelect (props) {
  const { store } = props
  const { workspaces } = store

  function handleLoadWorkspace (id) {
    window.store.loadWorkspace(id)
  }

  function handleDeleteWorkspace (id, ev) {
    ev.stopPropagation()
    window.store.deleteWorkspace(id)
  }

  function handleSaveClick () {
    window.store.workspaceSaveModalVisible = true
  }

  return (
    <div className='workspace-menu-content'>
      <div className='workspace-save-btn pd1b'>
        <Button
          type='primary'
          icon={<SaveOutlined />}
          size='small'
          onClick={handleSaveClick}
          block
        >
          {e('saveWorkspace')}
        </Button>
      </div>
      {workspaces.length === 0
        ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={e('noWorkspaces')}
          />
          )
        : (
          <div className='workspace-list'>
            {workspaces.map(ws => (
              <div
                key={ws.id}
                className='workspace-item'
                onClick={() => handleLoadWorkspace(ws.id)}
              >
                <span className='workspace-name'>{ws.name}</span>
                <Popconfirm
                  title={e('deleteWorkspace')}
                  onConfirm={(ev) => handleDeleteWorkspace(ws.id, ev)}
                  onCancel={(ev) => ev.stopPropagation()}
                  okText={e('ok')}
                  cancelText={e('cancel')}
                >
                  <DeleteOutlined
                    className='workspace-delete-icon'
                    onClick={(ev) => ev.stopPropagation()}
                  />
                </Popconfirm>
              </div>
            ))}
          </div>
          )}
    </div>
  )
})
