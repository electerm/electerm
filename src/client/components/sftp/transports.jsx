/**
 * tranporters
 */
import React from 'react'
import {Popover, Icon} from 'antd'
import Transport from './transport'
import _ from 'lodash'
import copy from 'json-deep-copy'
import {maxTransport} from '../../common/constants'
import {transportTypes} from './transport-types'

const {prefix} = window
const e = prefix('sftp')

function getFirstTransports(transports, max = maxTransport) {
  let trans = _.isArray(transports)
    ? transports
    : []
  let first = trans[0]
  if (!first) {
    return []
  }
  if (first.file.isDirectory) {
    return [first]
  }
  let res = []
  for (let i = 0;i < max;i ++) {
    let f = trans[i]
    if (!f.file.isDirectory) {
      res.push(f)
    } else {
      break
    }
  }
  return res
}

export default class Transports extends React.PureComponent {

  constructor(props) {
    super(props)
    this.state = {
      currentTransports: getFirstTransports(props.transports),
      showList: false
    }
  }

  componentDidUpdate(prevProps) {
    if (
      !_.isEqual(this.props.transports, prevProps.transports)
    ) {
      this.rebuildState()
    }
  }

  componentWillUnmount() {
    clearTimeout(this.timer)
  }

  onVisibleChange = showList => {
    this.setState({
      showList
    })
  }

  hide = () => {
    this.setState({
      showList: false
    })
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

  cancelAll = async () => {
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

  rebuildState = (nextProps = this.props) => {
    let transports = copy(nextProps.transports)
    let currentTransports = copy(this.state.currentTransports)
    let idsAll = transports.map(d => d.id)
    currentTransports = currentTransports.filter(c => {
      return idsAll.includes(c.id)
    })
    let cids = currentTransports.map(c => c.id)
    let max = maxTransport - cids.length
    transports = transports.filter(t => {
      return !cids.includes(t.id)
    })
    transports = getFirstTransports(transports, max)
    currentTransports = [
      ...currentTransports,
      ...transports
    ]
    this.setState(() => {
      return {
        currentTransports
      }
    })
  }

  renderContent = () => {
    let {transports, addTransferHistory} = this.props
    let {currentTransports} = this.state
    return (
      <div className="transports-content overscroll-y">
        {
          transports.map((t ,i) => {
            let {id} = t
            return (
              <Transport
                transport={t}
                key={id + ':tr:' + i}
                {...this.props}
                addTransferHistory={addTransferHistory}
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

  renderTransportIcon() {
    let pausing = _.get(this.state.currentTransport, 'pausing')
    let icon = pausing ? 'play-circle' : 'pause-circle'
    return (
      <Icon type={icon} />
    )
  }

  renderTitle() {
    return (
      <div className="fix">
        <div className="fleft">
          {e('fileTransfers')}
        </div>
        <div className="fright">
          <span
            className="pointer mg1r"
            onClick={this.hide}
          >
            {e('hide')}
          </span>
          <span
            className="color-red pointer"
            onClick={this.cancelAll}
          >
            {e('cancelAll')}
          </span>
        </div>
      </div>
    )
  }

  render() {
    let {transports, isActive} = this.props
    let {currentTransport, showList} = this.state
    let percent = _.get(currentTransport, 'percent')
    let leftTime = _.get(currentTransport, 'leftTime')
    let pausing = _.get(currentTransport, 'pausing')
    let func = pausing
      ? this.resume
      : this.pause
    if (!transports.length) {
      return null
    }
    return (
      <div className="tranports-wrap">
        <Popover
          title={this.renderTitle()}
          content={this.renderContent()}
          placement="bottom"
          visible={showList && isActive}
          onVisibleChange={this.onVisibleChange}
        >
          <div className="tranports-circle-wrap">
            <div
              className="opacity-loop pointer"
              onClick={func}
            >
              {this.renderTransportIcon()} {percent}%({leftTime})
              <span className="mg1l">
                [1 / {transports.length}]
              </span>
            </div>
          </div>
        </Popover>
      </div>
    )
  }
}
