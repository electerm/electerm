/**
 * process cpu/mem activities
 */

import { Table } from 'antd'
import _ from 'lodash'

export default function TerminalInfoActivities (props) {
  const { activities } = props
  if (_.isEmpty(activities) || !props.isRemote) {
    return null
  }
  const col = Object.keys(activities[0]).map(k => {
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
    rowKey: 'pid',
    dataSource: activities,
    bordered: true,
    columns: col,
    size: 'small',
    pagination: {
      pageSize: 10000
    }
  }
  return (
    <div className='terminal-info-section terminal-info-act'>
      <div className='pd1y'>Activities</div>
      <Table {...ps} />
    </div>
  )
}
