import { auto } from 'manate/react'
import {
  Modal,
  Spin,
  Button
} from 'antd'
import { useState, useEffect, useCallback } from 'react'
import SshConfigItem from './ssh-config-item'

export default auto(function LoadSshConfigs () {
  const [loading, setLoading] = useState(false)
  const [sshConfigs, setSshConfigs] = useState([])

  const {
    store
  } = window
  const {
    showSshConfigModal
  } = store
  if (!showSshConfigModal) {
    return null
  }
  const loadSshConfig = useCallback(async function () {
    setLoading(true)
    const arr = await store.fetchSshConfigItems()
    setSshConfigs(arr)
    setLoading(false)
  })

  const handleLoadSshConfig = useCallback(function () {
    store.storeAssign({
      showSshConfigModal: false
    })
    store.addSshConfigs(sshConfigs)
  })

  const renderList = useCallback(function () {
    return sshConfigs.map((d, i) => {
      return (
        <SshConfigItem item={d} key={d.title} />
      )
    })
  }, [sshConfigs])

  useEffect(() => {
    loadSshConfig()
  }, [])
  const modProps = {
    title: 'Load SSH configs from ~/.ssh/config',
    footer: null,
    open: true,
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
            onClick={handleLoadSshConfig}
          >
            Load
          </Button>
        </div>
      </Spin>
    </Modal>
  )
})
