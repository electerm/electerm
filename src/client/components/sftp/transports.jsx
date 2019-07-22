/**
 * tranporters
 */
import React from 'react'
import { Icon } from 'antd'
import Transport from './transport'
import _ from 'lodash'
import copy from 'json-deep-copy'
import { maxTransport } from '../../common/constants'
import { transportTypes } from './transport-types'

const { prefix } = window
const e = prefix('sftp')

function getFirstTransports (transports, max = maxTransport) {
  const trans = _.isArray(transports)
    ? transports
    : []
  const first = trans[0]
  if (!first) {
    return []
  }
  if (first.file.isDirectory) {
    return [first]
  }
  const res = []
  for (let i = 0; i < max; i++) {
    const f = trans[i]
    if (!f) {
      break
    }
    if (!f.file.isDirectory) {
      res.push(f)
    } else {
      break
    }
  }
  return res
}

export default class Transports extends React.PureComponent {
  constructor (props) {
    super(props)
    this.state = {
      currentTransports: getFirstTransports(props.transports)
    }
  }

  componentDidUpdate (prevProps) {
    if (
      !_.isEqual(this.props.transports, prevProps.transports)
    ) {
      this.rebuildState(this.props.transports, prevProps.transports)
    }
  }

  componentWillUnmount () {
    clearTimeout(this.timer)
  }

  pause = () => {
    window.postMessage({
      action: transportTypes.pauseTransport,
      ids: this.state.currentTransports.map(d => d.id)
    }, '*')
  }

  resume = () => {
    window.postMessage({
      action: transportTypes.resumeTransport,
      ids: this.state.currentTransports.map(d => d.id)
    }, '*')
  }

  modifyAsync = (data) => {
    return new Promise(resolve => {
      this.props.modifier(data, resolve)
    })
  }

  cancelAll = () => {
    window.postMessage({
      action: transportTypes.cancelTransport,
      ids: this.state.currentTransports.map(d => d.id)
    }, '*')
    this.timer = setTimeout(() => {
      this.props.modifier({
        transports: []
      })
    }, 300)
  }

  rebuildState = (newtrans) => {
    let transports = copy(newtrans)
    let currentTransports = copy(this.state.currentTransports)
    const idsAll = transports.map(d => d.id)
    currentTransports = currentTransports.filter(c => {
      return idsAll.includes(c.id)
    })
    const cids = currentTransports.map(c => c.id)
    const max = maxTransport - cids.length
    transports = transports.filter(t => {
      return !cids.includes(t.id)
    })
    transports = getFirstTransports(transports, max)
    currentTransports = [
      ...currentTransports,
      ...transports
    ]
    this.setState({
      currentTransports
    })
  }

  renderContent = () => {
    const { transports } = this.props
    const { currentTransports } = this.state
    return (
      <div className='transports-content overscroll-y'>
        {
          transports.map((t, i) => {
            const { id } = t
            return (
              <Transport
                {...this.props}
                transport={t}
                key={id + ':tr:' + i}
                onChildDestroy={this.onChildDestroy}
                currentTransports={currentTransports}
                index={i}
              />
            )
          })
        }
      </div>
    )
  }

  renderTransportIcon () {
    const pausing = this.computePausing()
    const icon = pausing ? 'play-circle' : 'pause-circle'
    return (
      <Icon type={icon} />
    )
  }

  renderTitle () {
    return (
      <div className='fix transports-title'>
        <div className='fleft'>
          {e('fileTransfers')}
        </div>
        <div className='fright'>
          <span
            className='color-red pointer'
            onClick={this.cancelAll}
          >
            {e('cancelAll')}
          </span>
        </div>
      </div>
    )
  }

  computePercent = () => {
    const ids = this.state.currentTransports.map(r => r.id)
    const trs = this.props.transports.filter(t => ids.includes(t.id))
    const { all, transfered } = trs.reduce((prev, c) => {
      prev.all += c.file.size
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
    const ids = this.state.currentTransports.map(r => r.id)
    const trs = this.props.transports.filter(t => ids.includes(t.id))
    const sorted = copy(trs).sort((b, a) => a.leftTimeInt - b.leftTimeInt)
    return _.get(sorted, '[0].leftTime') || '-'
  }

  computePausing = () => {
    const ids = this.state.currentTransports.map(r => r.id)
    const trs = this.props.transports.filter(t => ids.includes(t.id))
    return trs.reduce((prev, c) => {
      return prev && c.pausing
    }, true)
  }

  render () {
    const { transports } = this.props
    const { currentTransports } = this.state
    const percent = this.computePercent()
    const leftTime = this.computeLeftTime()
    const pausing = this.computePausing()
    const func = pausing
      ? this.resume
      : this.pause
    if (!transports.length) {
      return null
    }
    return (
      <div className='tranports-wrap'>
        <div className='tranports-circle-wrap'>
          <div
            className='opacity-loop pointer'
            onClick={func}
          >
            {this.renderTransportIcon()} {percent}%({leftTime})
            <span className='mg1l'>
              [{currentTransports.length} / {transports.length}]
            </span>
          </div>
        </div>
        <div
          className='transports-dd'
        >
          {this.renderTitle()}
          {this.renderContent()}
        </div>
      </div>
    )
  }
}
