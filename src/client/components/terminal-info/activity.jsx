/**
 * process cpu/mem activities
 */

import { Table } from 'antd'
import _ from 'lodash'
import { copy } from '../../common/clipboard'

const { prefix } = window
const m = prefix('menu')

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
      },
      render: (txt) => {
        return (
          <div className='activity-item'>
            <span>{txt}</span>
            <span
              className='pointer activity-item-copy mg1l bold color-blue'
              onClick={() => copy(txt)}
            >
              {m('copy')}
            </span>
          </div>
        )
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
      <div className='pd1y bold'>Activities</div>
      <Table {...ps} />
    </div>
  )
}
