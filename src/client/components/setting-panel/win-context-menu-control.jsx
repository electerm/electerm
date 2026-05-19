import React, { useState, useEffect } from 'react'
import { Button, Space, Tag, Tooltip } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import message from '../common/message'

const e = window.translate

export default function WinContextMenuControl () {
  const [loading, setLoading] = useState(false)
  const [registered, setRegistered] = useState(null)

  const checkStatus = async () => {
    try {
      const status = await window.pre.runGlobalAsync('checkContextMenuStatus')
      setRegistered(status)
    } catch (err) {
      console.error('Failed to check context menu status:', err)
    }
  }

  useEffect(() => {
    checkStatus()
  }, [])

  const handleRegister = async () => {
    setLoading(true)
    try {
      const result = await window.pre.runGlobalAsync('registerContextMenu')
      if (result.registered) {
        message.success(e('contextMenuRegistered') || 'Context menu registered successfully')
        setRegistered(true)
      } else {
        message.error(result.error || 'Failed to register context menu')
      }
    } catch (err) {
      message.error('Failed to register context menu')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleUnregister = async () => {
    setLoading(true)
    try {
      await window.pre.runGlobalAsync('unregisterContextMenu')
      message.success(e('contextMenuUnregistered') || 'Context menu removed successfully')
      setRegistered(false)
    } catch (err) {
      message.error('Failed to remove context menu')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const statusTag = registered === null
    ? null
    : registered
      ? (
        <Tag
          icon={<CheckCircleOutlined />}
          color='success'
          variant='solid'
        >
          {e('registered') || 'Registered'}
        </Tag>
        )
      : (
        <Tag
          icon={<CloseCircleOutlined />}
          color='default'
        >
          {e('notRegistered') || 'Not registered'}
        </Tag>
        )

  const tooltip = e('contextMenuTip') ||
    'Add "Open in electerm" to Windows Explorer right-click menu for folders. ' +
    'Right-clicking a folder will open a local terminal in electerm and cd into that folder.'

  return (
    <div className='pd2b'>
      <Tooltip title={tooltip}>
        <span className='inline-title mg1r'>
          {e('explorerContextMenu') || 'Explorer context menu'}
        </span>
      </Tooltip>
      <Space>
        {statusTag}
        {registered
          ? (
            <Button
              size='small'
              loading={loading}
              onClick={handleUnregister}
            >
              {e('removeContextMenu') || 'Remove'}
            </Button>
            )
          : (
            <Button
              type='primary'
              size='small'
              loading={loading}
              onClick={handleRegister}
            >
              {e('addContextMenu') || 'Add to Explorer'}
            </Button>
            )}
      </Space>
    </div>
  )
}
