import {
  Modal,
  Spin,
  Button
} from 'antd'
import { useState, useEffect } from 'react'
import SshConfigItem from './ssh-config-item'

const e = window.translate

export default function LoadSshConfigs (props) {
  const [loading, setLoading] = useState(false)
  const [sshConfigs, setSshConfigs] = useState([])

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
    const arr = await store.fetchSshConfigItems()
    setSshConfigs(arr)
    setLoading(false)
  }

  const handleLoadSshConfig = function () {
    store.showSshConfigModal = false
    store.addSshConfigs(sshConfigs)
  }

  const renderList = function () {
    return sshConfigs.map((d, i) => {
      return (
        <SshConfigItem item={d} key={d.title} />
      )
    })
  }

  useEffect(() => {
    loadSshConfig()
  }, [])
  if (!showSshConfigModal) {
    return null
  }
  const modProps = {
    title: 'Load SSH configs from ~/.ssh/config',
    footer: null,
    open: true,
    onCancel: handleCancel,
    width: '80%'
  }
  return (
    <Modal {...modProps}>
      <Spin spinning={loading}>
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
