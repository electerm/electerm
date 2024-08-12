import { Component } from '../common/react-subx'
import {
  Tabs
} from 'antd'
import Transports from './transfer-list-control'
import TransportHistory from './transfer-history-modal'

const e = window.translate

export default class TransferModal extends Component {
  renderTransfer = () => {
    return (
      <Transports
        store={this.props.store}
      />
    )
  }

  renderHistory = () => {
    return (
      <TransportHistory
        store={this.props.store}
      />
    )
  }

  render () {
    const {
      fileTransfers,
      transferHistory,
      transferTab,
      handleTransferTab
    } = this.props.store
    if (!fileTransfers.length && !transferHistory.length) {
      return null
    }
    const tabs = []
    if (fileTransfers.length) {
      tabs.push({
        title: e('fileTransfers'),
        id: 'transfer',
        render: this.renderTransfer
      })
    }
    if (transferHistory.length) {
      tabs.push({
        title: e('transferHistory'),
        id: 'history',
        render: this.renderHistory
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
          onChange={handleTransferTab}
          items={items}
        />
      </div>
    )
  }
}
