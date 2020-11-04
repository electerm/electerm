/**
 * transfer-history-modal
 */

import { Component } from '../common/react-subx'
import { CloseOutlined } from '@ant-design/icons'
import { Modal, Table } from 'antd'
import time from '../../../app/common/time'
import Tag from '../sftp/transfer-tag'
import './transfer-history.styl'
import _ from 'lodash'
import filesize from 'filesize'

const { prefix } = window
const e = prefix('transferHistory')
const f = prefix('sftp')
const m = prefix('menu')
const timeRender = t => time(t)
const sorterFactory = prop => {
  return (a, b) => {
    return _.get(a, prop) > _.get(b, prop) ? 1 : -1
  }
}
export default class TransferHistoryModal extends Component {
  render () {
    const {
      transferHistory,
      transferHistoryModalVisible,
      clearTransferHistory,
      closeTransferHistory
    } = this.props.store
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
      key: 'typeFrom',
      sorter: sorterFactory('typeFrom'),
      render: (type, inst) => {
        return (
          <Tag transfer={inst} />
        )
      }
    }, {
      title: m('host'),
      dataIndex: 'host',
      key: 'host',
      sorter: sorterFactory('host')
    }, {
      title: e('fromPath'),
      dataIndex: 'fromPath',
      key: 'fromPath',
      sorter: sorterFactory('fromPath')
    }, {
      title: e('toPath'),
      dataIndex: 'toPath',
      key: 'toPath',
      sorter: sorterFactory('toPath')
    }, {
      title: f('size'),
      dataIndex: 'fromFile.size',
      key: 'fromFile.size',
      sorter: sorterFactory('fromFile.size'),
      render: (v) => filesize(v || 0)
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
        width='90%'
        visible={transferHistoryModalVisible}
      >
        <div className='pd2'>
          <div>
            <span
              className='iblock pointer'
              onClick={clearTransferHistory}
            >
              <CloseOutlined className='mg1r' />
              {e('clear')}
            </span>
          </div>
          <div className='table-scroll-wrap'>
            <Table
              dataSource={transferHistory}
              columns={columns}
              bordered
              pagination={false}
              size='small'
              rowKey='id'
            />
          </div>
        </div>
      </Modal>
    )
  }
}
