import React, { useEffect } from 'react'
import { notification, Button } from 'antd'
import * as ls from '../../common/safe-local-storage'
import {
  sshConfigKey,
  sshConfigLoadKey
} from '../../common/constants'

const e = window.translate

function handleLoad () {
  window.store.showSshConfigModal = true
  notification.destroy('sshConfigNotify')
}

function handleIgnore () {
  ls.setItem(sshConfigKey, 'yes')
  notification.destroy('sshConfigNotify')
}

function showNotification () {
  notification.info({
    message: e('loadSshConfigs'),
    duration: 0,
    placement: 'bottom',
    key: 'sshConfigNotify',
    description: (
      <div>
        <p>{e('sshConfigNotice')}</p>
        <Button type='primary' onClick={handleLoad} className='mg1r mg1b'>
          {e('import')}
        </Button>
        <Button onClick={handleIgnore} className='mg1r mg1b'>
          {e('ignore')}
        </Button>
      </div>
    )
  })
}

export default function SshConfigLoadNotify (props) {
  const { settingTab, showModal, sshConfigs } = props

  useEffect(() => {
    const ignoreSshConfig = ls.getItem(sshConfigKey)
    const sshConfigLoaded = ls.getItem(sshConfigLoadKey)
    const shouldShow =
      sshConfigs.length &&
      ignoreSshConfig !== 'yes' &&
      settingTab === 'bookmarks' &&
      showModal &&
      sshConfigLoaded !== 'yes'

    if (shouldShow) {
      showNotification()
    }
  }, [settingTab, showModal, sshConfigs.length])

  return null
}
