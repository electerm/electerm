/**
 * disk info
 */

import { Table } from 'antd'
import _ from 'lodash'

export default function TerminalInfoDisk (props) {
  const { disks } = props
  if (_.isEmpty(disks) || !props.isRemote) {
    return null
  }
  const col = Object.keys(disks[0]).map((k, i) => {
    return {
      title: k,
      dataIndex: k,
      key: k,
      sorter: (a, b) => {
        return a[k] > b[k] ? 1 : -1
      }
    }
  })
  const ps = {
    rowKey: (rec) => `${rec.mount}_${rec.filesystem}`,
    dataSource: disks,
    bordered: true,
    columns: col,
    size: 'small',
    pagination: {
      pageSize: 10000
    }
  }
  return (
    <div className='terminal-info-section terminal-info-disk'>
      <div className='pd1y bold'>File system</div>
      <Table {...ps} />
    </div>
  )
}
