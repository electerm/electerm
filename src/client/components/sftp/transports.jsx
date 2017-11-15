/**
 * tranporters
 */
import React from 'react'
import {Progress, Popover, Icon} from 'antd'
import Transport from './transport'
import _ from 'lodash'
import copy from 'json-deep-copy'

export default class Transports extends React.Component {

  constructor(props) {
    super(props)
    this.state = {
      currentTransport: props.transports[0] || null,
      showList: false
    }
  }

  componentWillReceiveProps(nextProps) {
    if (
      !_.isEqual(this.props.transports, nextProps.transports)
    ) {
      this.rebuildState(nextProps)
    }
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.onCancel && this.props.transports.length) {
      this.props.modifier({
        transports: []
      })
    } else {
      this.onCancel = false
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

  pause = (e, cb) => {
    let {id} = this.state.currentTransport
    this[`ref__${id}`].pause(e, cb)
  }

  resume = () => {
    let {id} = this.state.currentTransport
    this[`ref__${id}`].resume()
  }

  cancelAll = async () => {
    this.pause()
    this.onCancel = true
    this.props.modifier({
      transports: []
    })
    this.timer = setTimeout(() => {
      this.props.modifier({
        transports: []
      })
    }, 500)
  }

  rebuildState = (nextProps = this.props) => {
    let {transports} = nextProps
    let {currentTransport} = this.state
    let has = _.find(transports, t => t.id === _.get(currentTransport, 'id'))
    if (!has) {
      let cur = transports[0] || null
      this.setState({
        currentTransport: copy(cur),
        showList: !!cur
      })
    } else {
      let showList = currentTransport.id !== has.id
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
    let {transports} = this.props
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
          file transfers
        </div>
        <div className="fright">
          <span
            className="pointer"
            onClick={this.cancelAll}
          >
            cancel all
          </span>
        </div>
      </div>
    )
  }

  render() {
    let {transports} = this.props
    let {currentTransport, showList} = this.state
    let percent = _.get(currentTransport, 'percent')
    let status = _.get(currentTransport, 'status')
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
          visible={showList}
          onVisibleChange={this.onVisibleChange}
        >
          <div className="tranports-circle-wrap">
            <Progress
              type="circle"
              className="transport-circle"
              width={40}
              percent={percent}
              status={status}
            />
            <div
              className="tranports-control opacity-loop pointer"
              onClick={func}
            >
              {this.renderTransportIcon()}
            </div>
          </div>
        </Popover>
      </div>
    )
  }
}
