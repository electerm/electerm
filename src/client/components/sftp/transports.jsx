/**
 * tranporters
 */
import React from 'react'
import {Popover, Icon} from 'antd'
import Transport from './transport'
import _ from 'lodash'
import copy from 'json-deep-copy'
import {maxTransport} from '../../common/constants'

const {prefix} = window
const e = prefix('sftp')

function getFirstTransports(transports) {
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
  for (let i = 0;i < maxTransport;i ++) {
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

  refs = {}

  onChildDestroy = id => {
    delete this[`ref__${id}`]
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
      action: 'pause-transport',
      ids: this.state.currentTransports.map(d => d.id)
    }, '*')
  }

  resume = () => {
    window.postMessage({
      action: 'resume-transport',
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
      action: 'cancel-transport',
      ids: this.state.currentTransports.map(d => d.id)
    }, '*')
    this.timer = setTimeout(() => {
      this.props.modifier({
        transports: []
      })
    }, 300)
  }

  rebuildState = (nextProps = this.props) => {
    let {transports} = nextProps
    let {currentTransports} = this.state
    let has = _.find(transports, t => t.id === _.get(currentTransports, 'id'))
    if (!has) {
      let cur = transports[0] || null
      this.setState({
        currentTransport: copy(cur),
        showList: !!cur
      })
    } else {
      let showList = currentTransports.id !== has.id
      let update = {
        currentTransport: copy(has)
      }
      if (showList) {
        update.showList = true
      }
      this.setState(update)
    }
  }

  renderContent = () => {
    let {transports, addTransferHistory} = this.props
    let {currentTransport} = this.state
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
                currentTransport={currentTransport}
                ref={ref => this[`ref__${id}`] = ref}
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
