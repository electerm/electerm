/**
 * process cpu/mem activities
 */

import { Table, Tooltip, Popconfirm } from 'antd'
import { isEmpty } from 'lodash-es'
import { CloseCircleOutlined } from '@ant-design/icons'
import colsParser from './data-cols-parser'

const { prefix } = window
const m = prefix('menu')

export default function TerminalInfoActivities (props) {
  const { activities } = props
  if (isEmpty(activities) || !props.isRemote) {
    return null
  }
  const col = colsParser(activities[0])
  col.unshift({
    dataIndex: 'kill',
    key: 'kill',
    title: m('close'),
    render: (txt, inst) => {
      return (
        <Tooltip
          title={m('close')}
        >
          <Popconfirm
            title={m('close') + ' pid:' + inst.pid + ' ?'}
            onConfirm={() => props.killProcess(inst.pid)}
          >
            <CloseCircleOutlined
              className='pointer'
            />
          </Popconfirm>
        </Tooltip>
      )
    }
  })
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
