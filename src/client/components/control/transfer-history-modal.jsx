/**
 * transfer-history-modal
 */

import {Modal, Table, Icon} from 'antd'
import moment from 'moment'

const {prefix} = window
const e = prefix('transferHistory')
const f = prefix('sftp')
const timeRender = time => moment(time).format()
const sorterFactory = prop => {
  return (a, b) => {
    return a[prop] > b[prop] ? 1 : -1
  }
}

export default ({
  transferHistory,
  transferHistoryModalVisible,
  clearTransferHistory,
  closeTransferHistory
}) => {
  const columns = [{
    title: e('startTime'),
    dataIndex: 'startTime',
    key: 'startTime',
    sorter: sorterFactory('startTime'),
    render: timeRender
  }, {
    title: e('finishTime'),
    dataIndex: 'finishTime',
    key: 'finishTime',
    sorter: sorterFactory('finishTime'),
    render: timeRender
  }, {
    title: e('type'),
    dataIndex: 'type',
    key: 'type',
    sorter: sorterFactory('type'),
    render: (type) => {
      return (
        <Icon type={type} />
      )
    }
  }, {
    title: e('localPath'),
    dataIndex: 'localPath',
    key: 'localPath',
    sorter: sorterFactory('localPath')
  }, {
    title: e('remotePath'),
    dataIndex: 'remotePath',
    key: 'remotePath',
    sorter: sorterFactory('remotePath')
  }, {
    title: f('size'),
    dataIndex: 'size',
    key: 'size',
    sorter: sorterFactory('size')
  }, {
    title: e('speed'),
    dataIndex: 'speed',
    key: 'speed',
    sorter: sorterFactory('speed')
  }]
  return (
    <Modal
      onCancel={closeTransferHistory}
      footer={null}
      width="90%"
      visible={transferHistoryModalVisible}
    >
      <div className="pd2">
        <div>
          <span
            className="iblock pointer"
            onClick={clearTransferHistory}
          >
            <Icon type="close" className="mg1r" />
            {e('clear')}
          </span>
        </div>
        <Table
          dataSource={transferHistory}
          columns={columns}
          bordered
          pagination={false}
          size="small"
          rowKey="id"
        />
      </div>
    </Modal>
  )
}
