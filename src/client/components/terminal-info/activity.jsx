/**
 * process cpu/mem activities
 */

import { Table } from 'antd'
import _ from 'lodash'
import colsParser from './data-cols-parser'

export default function TerminalInfoActivities (props) {
  const { activities } = props
  if (_.isEmpty(activities) || !props.isRemote) {
    return null
  }
  const col = colsParser(activities[0])
  const ps = {
    rowKey: 'pid',
    dataSource: activities,
    bordered: true,
    columns: col,
    size: 'small',
    pagination: false
  }
  return (
    <div className='terminal-info-section terminal-info-act'>
      <div className='pd1y bold'>Activities</div>
      <Table {...ps} />
    </div>
  )
}
