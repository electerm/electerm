/**
 * transfer-history-modal
 */

import {Modal, Table} from 'antd'

const {prefix} = window
const e = prefix('transferHistory')


export default ({
  transferHistory,
  visible,
  onClose
}) => {
  if (!visible) {
    return null
  }
  const columns = [{
    title: e('startTime'),
    dataIndex: 'startTime',
    key: 'startTime',
    sorter: true
  }, {
    title: e('finishTime'),
    dataIndex: 'finishTime',
    key: 'finishTime',
    sorter: true
  }, {
    title: e('type'),
    dataIndex: 'type',
    key: 'type',
    sorter: true
  }, {
    title: e('from'),
    dataIndex: 'from',
    key: 'from',
    sorter: true
  }, {
    title: e('to'),
    dataIndex: 'to',
    key: 'to',
    sorter: true
  }, {
    title: e('size'),
    dataIndex: 'size',
    key: 'size',
    sorter: true
  }, {
    title: e('speed'),
    dataIndex: 'speed',
    key: 'speed',
    sorter: true
  }]
  return (
    <Modal
      onCancel={onClose}
      footer={null}
    >
      <div className="pd2">
        <Table
          dataSource={transferHistory}
          columns={columns}
          size="small"
        />
      </div>
    </Modal>
  )
}
