import React, { useState, useEffect, useCallback } from 'react'
import { Button, Tag, Space, Tooltip } from 'antd'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined
} from '@ant-design/icons'
import message from '../common/message'
import HelpIcon from '../common/help-icon'
import { installCommandHelpLink } from '../../common/constants'

// The row title and the two buttons come from electerm-locales
// (`command` / `install` / `uninstall`); the descriptive lines are still plain
// English and the maintainer adds keys for them as needed.
// window.translate is installed by entry/basic.js, so look it up at call time
// rather than capturing it when this module is evaluated.
const t = key => window.translate(key)

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

  const handleInstall = () =>
    run('installElectermCommand', `electerm ${t('command')} installed`)
  const handleUninstall = () =>
    run('uninstallElectermCommand', `electerm ${t('command')} removed`)

  if (!status) {
    return null
  }

  const { installed, inPath, binDir, stale, blocked, unpackaged } = status
  const needsPath = installed && inPath === false

  // In a dev run process.execPath is Electron, so installing would point the
  // command at Electron. Say so rather than offering a button that breaks it.
  if (unpackaged) {
    return null
  }

  return (
    <div className='pd2b'>
      <div className='pd1b'>
        <Space size='small' wrap>
          <span className='inline-title'>{t('install')} electerm {t('command')} to PATH</span>
          <HelpIcon link={installCommandHelpLink} />
          <Tag
            variant='solid'
            icon={installed ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
            color={installed ? 'success' : 'default'}
          >
            {installed ? 'Installed' : (stale ? 'Outdated' : 'Not installed')}
          </Tag>
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
      {
        stale
          ? (
            <div className='pd1b'>
              <WarningOutlined className='mg1r' />
              This command points somewhere else now. Install again to update it.
            </div>
            )
          : null
      }
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
          {t('install')}
        </Button>
        {
          installed || stale
            ? (
              <Button
                color='danger'
                variant='solid'
                onClick={handleUninstall}
                loading={loading}
              >
                {t('uninstall')}
              </Button>
              )
            : null
        }
      </div>
    </div>
  )
}
