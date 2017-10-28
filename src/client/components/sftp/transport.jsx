/**
 * tranporter
 */
import React from 'react'
import {Icon} from 'antd'
import copy from 'json-deep-copy'
import _ from 'lodash'

const typeIconMap = {
  upload: 'arrow-up',
  download: 'arrow-down'
}
const typeIconMap2 = {
  upload: 'swap-right',
  download: 'swap-left'
}

export default class Tranporter extends React.Component {

  componentWillMount() {
    this.startTransfer()
  }

  componentWillReceiveProps(nextProps) {
    let before = this.props.currentTransport
    let after = nextProps.currentTransport
    if (!_.isEqual(before, after)) {
      this.startTransfer()
    }
  }

  componentWillUnmount() {
    this.transport && this.transport.destroy && this.transport.destroy()
    clearTimeout(this.timer)
  }

  update = transport => {
    let transports = copy(this.props.transports)
    let index = _.findIndex(transports, t => t.id === transport.id)
    transports.splice(index, 1, transport)
    this.props.modifier({
      transports
    })
  }

  pause = () => {
    let transport = copy(this.props.transport)
    transport.pausing = true
    this.update(transport)
    this.transport.pause()
  }

  resume = () => {
    let transport = copy(this.props.transport)
    transport.pausing = false
    this.update(transport)
    this.transport.resume()
  }

  onData = _.throttle((transferred) => {
    let transport = copy(this.props.transport)
    let total = transport.file.size
    let percent = total === 0
      ? 0
      : Math.floor(100 * transferred / total)
    transport.percent = percent
    transport.status = 'active'
    this.update(transport)
  }, 100)

  onError = e => {
    let transport = copy(this.props.transport)
    transport.status = 'exception'
    this.update(transport)
    this.props.onError(e)
  }

  onEnd = () => {
    if (this.onCancel) {
      return
    }
    let {type} = this.props.transport
    type = type === 'download' ? 'local' : 'remote'
    let cb = this.props[type + 'List']
    this.timer = setTimeout(
      () => this.cancel(cb),
      100
    )
  }

  startTransfer = async () => {
    let {id} = this.props.transport
    let {currentTransport} = this.props
    if (
      _.get(currentTransport, 'id') === id && !this.started
    ) {
      this.started = true
      let {
        type,
        localPath,
        remotePath
      } = this.props.transport
      this.transport = this.props.sftp[type]({
        remotePath,
        localPath,
        ..._.pick(this, [
          'onData',
          'onError',
          'onEnd'
        ])
      })
    }
  }

  cancel = (callback) => {
    let {id} = this.props.transport
    let transports = copy(this.props.transports).filter(t => {
      return t.id !== id
    })
    this.onCancel = true
    this.props.modifier({
      transports
    }, _.isFunction(callback) ? callback : undefined)
  }

  render() {
    let {
      localPath,
      remotePath,
      type,
      percent,
      status,
      pausing = false
    } = this.props.transport
    let pauseIcon = pausing ? 'play-circle' : 'pause-circle'
    let pauseTitle = pausing ? 'resume' : 'pause'
    let pauseFunc = pausing ? this.resume : this.pause
    let icon = typeIconMap[type]
    let icon2 = typeIconMap2[type]
    return (
      <div className="sftp-transport mg1b pd1x">
        <Icon type={icon} className="sftp-type-icon iblock mg1r color-blue" />
        <span
          className="sftp-file sftp-local-file elli width200 iblock"
          title={localPath}
        >{localPath}</span>
        <Icon type={icon2} className="sftp-direction-icon mg1x iblock" />
        <span
          className="sftp-file sftp-remote-file elli mg1r width200 iblock"
          title={localPath}
        >{remotePath}</span>
        <span
          className={`sftp-file-percent mg1r iblock sftp-status-${status}`}
          title={localPath}
        >{percent}%</span>
        <Icon
          type={pauseIcon}
          className="sftp-control-icon iblock pointer mg1r hover-black"
          onClick={pauseFunc}
          title={pauseTitle}
        />
        <Icon
          type="close-circle"
          className="sftp-control-icon iblock pointer hover-black"
          onClick={this.cancel}
          title="cancel"
        />
      </div>
    )
  }
}
