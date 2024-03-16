/**
 * network info
 */

import { Table } from 'antd'
import { isEmpty } from 'lodash-es'
import { useEffect, useState } from 'react'
import { formatBytes } from '../../common/byte-format'
import copy from 'json-deep-copy'
import { ApiOutlined } from '@ant-design/icons'

export default function TerminalInfoDisk (props) {
  const { network, isRemote, terminalInfos } = props
  if (isEmpty(network) || !isRemote || !terminalInfos.includes('network')) {
    return null
  }
  const [state, setter] = useState({
    network: props.network,
    time: Date.now()
  })
  function setState (ext) {
    setter(s => {
      return Object.assign({}, s, ext)
    })
  }
  function updateTraffic () {
    const network = copy(props.network)
    const keys = Object.keys(network)
    const net = copy(state.network)
    const now = Date.now()
    const { time } = state
    const diff = (now - time) / 1000
    for (const k of keys) {
      const p = network[k]
      const pv = net[k]
      if (
        p &&
        pv &&
        p.download &&
        pv.download &&
        p.download > pv.download
      ) {
        p.down = Math.floor((p.download - pv.download) / diff)
      }
      if (
        p &&
        pv &&
        p.upload &&
        pv.upload &&
        p.upload > pv.upload
      ) {
        p.up = Math.floor((p.upload - pv.upload) / diff)
      }
    }
    setState({
      network,
      time: now
    })
  }
  useEffect(() => {
    updateTraffic()
  }, [props.network])
  if (isEmpty(state)) {
    return null
  }
  const arr = Object.keys(state.network).map(k => {
    return {
      name: k,
      ...state.network[k]
    }
  }).sort((a, b) => {
    const ai = a.name.startsWith('eth') ? 100 : 10
    const bi = b.name.startsWith('eth') ? 100 : 10
    if (ai !== bi) {
      return bi - ai
    }
    return a.name > b.name ? 1 : -1
  })
  const map = {
    up: '↑',
    down: '↓',
    name: 'name',
    ip: 'ipv4'
  }
  const col = ['name', 'ip', 'up', 'down'].map((k, i) => {
    return {
      title: map[k],
      dataIndex: k,
      key: k,
      sorter: (a, b) => {
        return a[k] > b[k] ? 1 : -1
      },
      render: (v) => {
        if (k === 'up' || k === 'down') {
          return formatBytes(v)
        }
        return v
      }
    }
  })
  const ps = {
    rowKey: 'name',
    dataSource: arr,
    bordered: true,
    size: 'small',
    columns: col,
    pagination: false
  }
  return (
    <div className='terminal-info-section terminal-info-network'>
      <div className='pd1y bold'><ApiOutlined /> Network</div>
      <Table {...ps} />
    </div>
  )
}
