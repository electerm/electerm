/**
 * transfer-history-modal
 */

import { Component } from '../common/react-subx'
import { CloseOutlined } from '@ant-design/icons'
import { Table } from 'antd'
import time from '../../common/time'
import Tag from '../sftp/transfer-tag'
import './transfer-history.styl'
import { get as _get } from 'lodash-es'
import { filesize } from 'filesize'

const { prefix } = window
const e = prefix('transferHistory')
const f = prefix('sftp')
const m = prefix('menu')
const timeRender = t => time(t)
const sorterFactory = prop => {
  return (a, b) => {
    return _get(a, prop) > _get(b, prop) ? 1 : -1
  }
}
export default class TransferHistoryModal extends Component {
  render () {
    const {
      getTransferHistory,
      clearTransferHistory
    } = this.props.store
    const transferHistory = getTransferHistory()
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
      render: (txt, inst) => {
        return inst.fromPathReal || txt
      },
      sorter: sorterFactory('fromPath')
    }, {
      title: e('toPath'),
      dataIndex: 'toPath',
      key: 'toPath',
      render: (txt, inst) => {
        return inst.toPathReal || txt
      },
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
    )
  }
}
