import {
  Tabs
} from 'antd'
import Transports from './transfer-list-control'
import TransportHistory from './transfer-history-modal'
import { memo } from 'react'

const e = window.translate

export default memo(function TransferModal (props) {
  const renderTransfer = () => {
    return (
      <Transports
        fileTransfers={props.fileTransfers}
      />
    )
  }

  const renderHistory = () => {
    return (
      <TransportHistory
        transferHistory={props.transferHistory}
      />
    )
  }

  const {
    fileTransfers,
    transferHistory,
    transferTab
  } = props
  if (!fileTransfers.length && !transferHistory.length) {
    return null
  }
  const tabs = []
  if (fileTransfers.length) {
    tabs.push({
      title: e('fileTransfers'),
      id: 'transfer',
      render: renderTransfer
    })
  }
  if (transferHistory.length) {
    tabs.push({
      title: e('transferHistory'),
      id: 'history',
      render: renderHistory
    })
  }
  const activeTab = tabs.map(d => d.id).includes(transferTab)
    ? transferTab
    : tabs[0].id
  const items = tabs.map(tab => {
    return {
      key: tab.id,
      label: tab.title,
      children: tab.render()
    }
  })
  return (
    <div
      className='pd1'
    >
      <Tabs
        activeKey={activeTab}
        onChange={window.store.handleTransferTab}
        items={items}
      />
    </div>
  )
})
