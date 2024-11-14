import { memo, useState } from 'react'
import {
  Select
} from 'antd'
import Transport from './transport-ui'
import {
  PlayCircleOutlined,
  PauseCircleOutlined
} from '@ant-design/icons'
import { get } from 'lodash-es'

const { Option } = Select

const e = window.translate

export default memo(function TransferModalUI (props) {
  const [filter, setFilter] = useState('all')

  function getCurrentTransports () {
    return getTransferList().filter(t => t.inited)
  }

  function handlePauseOrResumeAll () {
    const { store } = window
    store.pauseAllTransfer ? store.resumeAll() : store.pauseAll()
  }

  function handleCancelAll () {
    window.store.cancelAll()
  }

  function getGroups () {
    const { fileTransfers } = props
    const tree = fileTransfers.reduce((p, k) => {
      const {
        id,
        title,
        sessionId
      } = k
      if (!p[sessionId]) {
        p[sessionId] = {
          title,
          transfers: []
        }
      }
      p[sessionId].transfers.push(id)
      return p
    }, {})
    return Object.keys(tree)
      .map(id => {
        const { transfers, title } = tree[id]
        return {
          id,
          transfers,
          title
        }
      })
  }

  function handleFilter (filter) {
    setFilter(filter)
  }

  function getTransferList () {
    const fileTransfers = props.fileTransfers
    return filter === 'all'
      ? fileTransfers
      : fileTransfers.filter(d => d.sessionId === filter)
  }

  function computePercent () {
    const { all, transfered } = getTransferList().reduce((prev, c) => {
      prev.all += c?.fromFile?.size || 0
      prev.transfered += (c.transferred || 0)
      return prev
    }, {
      all: 0,
      transfered: 0
    })
    let percent = all === 0
      ? 0
      : Math.floor(100 * transfered / all)
    percent = percent >= 100 ? 99 : percent
    return percent
  }

  function computeLeftTime () {
    const sorted = getCurrentTransports().sort((b, a) => a.leftTimeInt - b.leftTimeInt)
    return get(sorted, '[0].leftTime') || '-'
  }

  function computePausing () {
    return getCurrentTransports().reduce((prev, c) => {
      return prev && c.pausing
    }, true)
  }

  function renderTransportIcon () {
    const pausing = computePausing()
    const Icon = pausing ? PlayCircleOutlined : PauseCircleOutlined
    return <Icon className='font14' />
  }

  function renderTransfers () {
    return (
      <div className='transports-content overscroll-y'>
        {
          getTransferList().map((t, i) => {
            const { id } = t
            return (
              <Transport
                transfer={t}
                key={id + ':tr:' + i}
              />
            )
          })
        }
      </div>
    )
  }

  function renderFilters () {
    const groups = getGroups()
    const all = [
      {
        id: 'all',
        title: 'All'
      },
      ...groups
    ]
    return (
      <div>
        <Select
          value={filter}
          onChange={handleFilter}
          popupMatchSelectWidth={false}
        >
          {
            all.map(item => {
              return (
                <Option
                  key={item.id}
                  value={item.id}
                >
                  {item.title}
                </Option>
              )
            })
          }
        </Select>
      </div>
    )
  }

  return (
    <div className='pd1t'>
      <div className='transports-wrap-side fix pd1y'>
        <div
          className='fleft'
        >
          {
            renderFilters()
          }
        </div>
        <div className='fright'>
          <span
            className='pointer'
            onClick={handlePauseOrResumeAll}
          >
            {renderTransportIcon()} {computePercent()}%({computeLeftTime()})
            <span className='mg1x'>
              [{getCurrentTransports().length} / {getTransferList().length}]
            </span>
          </span>
          <span
            className='color-red pointer'
            onClick={handleCancelAll}
          >
            {e('cancelAll')}
          </span>
        </div>
      </div>
      {renderTransfers()}
    </div>
  )
})
