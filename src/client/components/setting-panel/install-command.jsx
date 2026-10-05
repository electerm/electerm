import React, { useState, useEffect, useCallback } from 'react'
import { Button, Tag, Space, Tooltip } from 'antd'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined
} from '@ant-design/icons'
import message from '../common/message'

// Text is intentionally plain English here; the maintainer wires up
// window.translate keys for these labels.
export default function InstallCommand () {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const s = await window.pre.runGlobalAsync('getElectermCommandStatus')
      setStatus(s)
    } catch (err) {
      console.error('Failed to read electerm command status', err)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const run = async (name, okText) => {
    setLoading(true)
    try {
      const res = await window.pre.runGlobalAsync(name)
      if (res && res.ok) {
        message.success(okText)
      } else {
        message.error((res && res.message) || 'Failed to update the electerm command')
      }
      await refresh()
    } catch (err) {
      message.error(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleInstall = () => run('installElectermCommand', 'electerm command installed')
  const handleUninstall = () => run('uninstallElectermCommand', 'electerm command removed')

  if (!status) {
    return null
  }

  const { installed, inPath, binDir, stale, blocked } = status
  const needsPath = installed && inPath === false

  return (
    <div className='pd2b'>
      <div className='pd1b'>
        <Space size='small' wrap>
          <span className='inline-title'>electerm command line</span>
          <Tag
            variant='solid'
            icon={installed ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
            color={installed ? 'success' : 'default'}
          >
            {installed ? 'Installed' : 'Not installed'}
          </Tag>
          {
            stale
              ? (
                <Tag variant='solid' color='warning' icon={<WarningOutlined />}>
                  Outdated
                </Tag>
                )
              : null
          }
          {
            blocked
              ? (
                <Tag variant='solid' color='error' icon={<WarningOutlined />}>
                  Blocked
                </Tag>
                )
              : null
          }
        </Space>
      </div>
      <div className='pd1b'>
        Run <code>electerm</code> from a terminal to connect straight from the
        command line.
      </div>
      {
        binDir
          ? (
            <div className='pd1b'>
              <Tooltip title={binDir}>
                <span>{binDir}</span>
              </Tooltip>
            </div>
            )
          : null
      }
      {
        needsPath
          ? (
            <div className='pd1b'>
              <WarningOutlined className='mg1r' />
              {binDir} is not in your PATH. Add it to PATH so the command can be found.
            </div>
            )
          : null
      }
      <div className='deep-link-btns'>
        <Button
          type='primary'
          onClick={handleInstall}
          loading={loading}
        >
          {installed ? 'Reinstall command' : 'Install command'}
        </Button>
        {
          installed
            ? (
              <Button
                color='danger'
                variant='solid'
                onClick={handleUninstall}
                loading={loading}
              >
                Uninstall
              </Button>
              )
            : null
        }
      </div>
    </div>
  )
}
