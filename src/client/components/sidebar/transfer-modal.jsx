import {
  Tabs
} from 'antd'
import { CloseOutlined } from '@ant-design/icons'
import Transports from './transfer-list-control'
import { memo, lazy, Suspense } from 'react'

// the history tab is an antd Table (~137 kB minified) that nobody needs before
// they actually open it: keep it out of the startup bundle. Only rendered when
// there is history, and only mounted on the history tab.
const TransportHistory = lazy(() => import('./transfer-history-modal'))

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
      <Suspense fallback={null}>
        <TransportHistory
          transferHistory={props.transferHistory}
        />
      </Suspense>
    )
  }

  const {
    fileTransfers,
    transferHistory,
    transferTab,
    onClose
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
        tabBarExtraContent={{
          right: (
            <span
              className='pointer transfer-modal-close'
              title={e('close')}
              onClick={onClose}
            >
              <CloseOutlined />
            </span>
          )
        }}
      />
    </div>
  )
})
