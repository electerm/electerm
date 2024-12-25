import { Component } from 'react'
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

export default class TransferModalUI extends Component {
  state = {
    filter: 'all'
  }

  getCurrentTransports = () => {
    return this.getTransferList().filter(t => t.inited)
  }

  handlePauseOrResumeAll = () => {
    const { store } = window
    store.pauseAllTransfer ? store.resumeAll() : store.pauseAll()
  }

  handleCancelAll = () => {
    window.store.cancelAll()
  }

  getGroups = () => {
    const { fileTransfers } = this.props
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

  handleFilter = (filter) => {
    this.setState({
      filter
    })
  }

  getTransferList = () => {
    const {
      filter
    } = this.state
    const fileTransfers = this.props.fileTransfers
    return filter === 'all'
      ? fileTransfers
      : fileTransfers.filter(d => d.sessionId === filter)
  }

  computePercent = () => {
    const { all, transfered } = this.getTransferList().reduce((prev, c) => {
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

  computeLeftTime = () => {
    const sorted = this.getCurrentTransports().sort((b, a) => a.leftTimeInt - b.leftTimeInt)
    return get(sorted, '[0].leftTime') || '-'
  }

  computePausing = () => {
    return this.getCurrentTransports().reduce((prev, c) => {
      return prev && c.pausing
    }, true)
  }

  renderTransportIcon = () => {
    const pausing = this.computePausing()
    const Icon = pausing ? PlayCircleOutlined : PauseCircleOutlined
    return <Icon className='font14' />
  }

  renderTransfers = () => {
    return (
      <div className='transports-content overscroll-y'>
        {
          this.getTransferList().map((t, i) => {
            const { id } = t
            return (
              <Transport
                transfer={t}
                index={i}
                key={id + ':tr:' + i}
              />
            )
          })
        }
      </div>
    )
  }

  renderFilters = () => {
    const groups = this.getGroups()
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
          value={this.state.filter}
          onChange={this.handleFilter}
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

  render () {
    return (
      <div className='pd1t'>
        <div className='transports-wrap-side fix pd1y'>
          <div
            className='fleft'
          >
            {
              this.renderFilters()
            }
          </div>
          <div className='fright'>
            <span
              className='pointer'
              onClick={this.handlePauseOrResumeAll}
            >
              {this.renderTransportIcon()} {this.computePercent()}%({this.computeLeftTime()})
              <span className='mg1x'>
                [{this.getCurrentTransports().length} / {this.getTransferList().length}]
              </span>
            </span>
            <span
              className='color-red pointer'
              onClick={this.handleCancelAll}
            >
              {e('cancelAll')}
            </span>
          </div>
        </div>
        {this.renderTransfers()}
      </div>
    )
  }
}
