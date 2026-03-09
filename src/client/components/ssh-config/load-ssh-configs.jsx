import {
  Modal,
  Spin,
  Button,
  Empty
} from 'antd'
import { useState, useEffect } from 'react'
import * as ls from '../../common/safe-local-storage'
import {
  sshConfigLoadKey
} from '../../common/constants'
import { ReloadOutlined } from '@ant-design/icons'
import LoadSshConfigsItem from './load-ssh-configs-item'
import './ssh-config.styl'

const e = window.translate

export default function LoadSshConfigs (props) {
  const [loading, setLoading] = useState(false)
  const { sshConfigs } = props
  const [localConfigs, setLocalConfigs] = useState([])

  const {
    store
  } = window
  const {
    showSshConfigModal
  } = props

  useEffect(() => {
    setLocalConfigs(sshConfigs)
  }, [sshConfigs])

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
    store.addSshConfigs(localConfigs)
    ls.setItem(sshConfigLoadKey, 'yes')
  }

  const handleDeleteItem = function (index) {
    const newConfigs = [...localConfigs]
    newConfigs.splice(index, 1)
    setLocalConfigs(newConfigs)
  }

  const handleUpdateItem = function (index, newItem) {
    const newConfigs = [...localConfigs]
    newConfigs[index] = newItem
    setLocalConfigs(newConfigs)
  }

  const renderList = function () {
    if (!localConfigs.length) {
      return (
        <Empty />
      )
    }
    return (
      <div className='pd1b ssh-config-list'>
        {
          localConfigs.map((item, index) => (
            <LoadSshConfigsItem
              key={index}
              item={item}
              index={index}
              onDelete={handleDeleteItem}
              onUpdate={handleUpdateItem}
            />
          ))
        }
      </div>
    )
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
            disabled={!localConfigs.length || loading}
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
