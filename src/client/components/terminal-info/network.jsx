/**
 * network info
 */

import { Table } from 'antd'
import _ from 'lodash'
import { useEffect, useState } from 'react'
import copy from 'json-deep-copy'

export default function TerminalInfoDisk (props) {
  const { network } = props
  if (_.isEmpty(network) || !props.isRemote) {
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
        p.down = Math.floor((p.download - pv.download) / diff) + 'k'
      }
      if (
        p &&
        pv &&
        p.upload &&
        pv.upload &&
        p.upload > pv.upload
      ) {
        p.up = Math.floor((p.upload - pv.upload) / diff) + 'k'
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
  if (_.isEmpty(state)) {
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
    name: 'name'
  }
  const col = ['name', 'up', 'down'].map((k, i) => {
    return {
      title: map[k],
      dataIndex: k,
      key: k,
      sorter: (a, b) => {
        return a[k] > b[k] ? 1 : -1
      }
    }
  })
  const ps = {
    rowKey: 'name',
    dataSource: arr,
    bordered: true,
    size: 'small',
    columns: col,
    pagination: {
      pageSize: 10000
    }
  }
  return (
    <div className='terminal-info-section terminal-info-network'>
      <div className='pd1y bold'>Network</div>
      <Table {...ps} />
    </div>
  )
}
