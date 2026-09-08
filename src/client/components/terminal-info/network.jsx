/**
 * Network counters and rates supplied by the shared remote monitor sampler.
 */

import { Table } from 'antd'
import { isEmpty } from 'lodash-es'
import { filesize } from 'filesize'
import { ApiOutlined } from '@ant-design/icons'

export default function TerminalInfoNetwork (props) {
  const { network, isRemote, terminalInfos } = props
  if (isEmpty(network) || !isRemote || !terminalInfos.includes('network')) {
    return null
  }
  const arr = Object.keys(network).map(name => ({
    name,
    ...network[name]
  })).sort((a, b) => {
    const ai = a.name.startsWith('eth') ? 100 : 10
    const bi = b.name.startsWith('eth') ? 100 : 10
    if (ai !== bi) {
      return bi - ai
    }
    return a.name > b.name ? 1 : -1
  })
  const labels = {
    up: '↑',
    down: '↓',
    name: 'name',
    ip: 'ipv4'
  }
  const columns = ['name', 'ip', 'up', 'down'].map(key => ({
    title: labels[key],
    dataIndex: key,
    key,
    sorter: (a, b) => a[key] > b[key] ? 1 : -1,
    render: value => {
      if (key === 'up' || key === 'down') {
        return Number.isFinite(value) ? `${filesize(value)}/s` : '—'
      }
      return value
    }
  }))
  return (
    <div className='terminal-info-section terminal-info-network'>
      <div className='pd1y bold'><ApiOutlined /> Network</div>
      <Table
        bordered
        columns={columns}
        dataSource={arr}
        pagination={false}
        rowKey='name'
        scroll={{ y: 180, x: 'max-content' }}
        size='small'
      />
    </div>
  )
}
