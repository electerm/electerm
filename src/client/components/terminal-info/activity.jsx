/**
 * process cpu/mem activities
 */

import { Table, Tooltip, Popconfirm } from 'antd'
import { isEmpty } from 'lodash-es'
import { CloseCircleOutlined, BarsOutlined } from '@ant-design/icons'
import colsParser from './data-cols-parser'

const e = window.translate

export default function TerminalInfoActivities (props) {
  const { activities, isRemote, terminalInfos } = props
  if (isEmpty(activities) || !isRemote || !terminalInfos.includes('activities')) {
    return null
  }
  const col = colsParser(activities[0])
  col.unshift({
    dataIndex: 'kill',
    key: 'kill',
    title: e('close'),
    render: (txt, inst) => {
      return (
        <Tooltip
          title={e('close')}
        >
          <Popconfirm
            title={e('close') + ' pid:' + inst.pid + ' ?'}
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
      <div className='pd1y bold'><BarsOutlined /> Activities</div>
      <Table {...ps} />
    </div>
  )
}
