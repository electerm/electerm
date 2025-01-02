import {
  Modal,
  Spin,
  Button,
  Empty
} from 'antd'
import { useState, useEffect } from 'react'
import SshConfigItem from './ssh-config-item'
import * as ls from '../../common/safe-local-storage'
import {
  sshConfigLoadKey
} from '../../common/constants'
import { ReloadOutlined } from '@ant-design/icons'

const e = window.translate

export default function LoadSshConfigs (props) {
  const [loading, setLoading] = useState(false)
  const { sshConfigs } = props

  const {
    store
  } = window
  const {
    showSshConfigModal
  } = props
  const handleCancel = function () {
    store.showSshConfigModal = false
  }
  const loadSshConfig = async function () {
    setLoading(true)
    await store.fetchSshConfigItems()
    setLoading(false)
  }

  const handleLoadSshConfig = function () {
    store.showSshConfigModal = false
    store.addSshConfigs(sshConfigs)
    ls.setItem(sshConfigLoadKey, 'yes')
  }

  const renderList = function () {
    if (!sshConfigs.length) {
      return (
        <Empty />
      )
    }
    return sshConfigs.map((d, i) => {
      return (
        <SshConfigItem item={d} key={d.title} />
      )
    })
  }

  useEffect(() => {
    if (sshConfigs.length && ls.getItem(sshConfigLoadKey) !== 'yes') {
      loadSshConfig()
    }
  }, [sshConfigs.length])
  if (!showSshConfigModal) {
    return null
  }
  const modProps = {
    title: e('loadSshConfigs'),
    footer: null,
    open: true,
    onCancel: handleCancel,
    width: '80%'
  }
  return (
    <Modal {...modProps}>
      <Spin spinning={loading}>
        <div className='pd1y'>
          <Button
            onClick={loadSshConfig}
            disabled={loading}
            className='mg1b'
          >
            <ReloadOutlined /> {e('reload')}
          </Button>
        </div>
        <div className='ssh-config-list'>
          {
            renderList()
          }
        </div>
        <div className='pd1y'>
          <Button
            type='primary'
            className='mg1r mg1b'
            onClick={handleLoadSshConfig}
            disabled={!sshConfigs.length || loading}
          >
            {e('import')}
          </Button>
          <Button
            onClick={handleCancel}
            className='mg1r mg1b'
          >
            {e('cancel')}
          </Button>
        </div>
      </Spin>
    </Modal>
  )
}
