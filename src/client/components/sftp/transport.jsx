/**
 * tranporter
 */
import React from 'react'
import {Progress, Icon} from 'antd'
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
    let before = _.get(this.props, 'currentTransport.id')
    let after = _.get(nextProps, 'currentTransport.id')
    if (before !== after) {
      this.startTransfer()
    }
  }

  componentWillUnmount() {
    let {id} = this.props.transport
    let {currentTransport} = this.props
    if (id === currentTransport.id) {
      this.props.sftp.close()
    }
  }

  update = transport => {
    let transports = copy(this.props.transports)
    let index = _.findIndex(transports, t => t.id === transport.id)
    transports.splice(index, 1, transport)
    this.props.modifier({
      transports
    })
  }

  onData = (transferred, chunk, total) => {
    let percent = transferred / total
    let transport = copy(this.props.transport)
    transport.percent = percent
    transport.status = 'active'
    this.update(transport)
  }

  onError = e => {
    let transport = copy(this.props.transport)
    transport.status = 'exception'
    this.update(transport)
    this.props.onError(e)
  }

  startTransfer = async () => {
    let {id} = this.props.transport
    let {currentTransport} = this.props
    if (currentTransport.id === id) {
      let {
        type,
        localPath,
        remotePath
      } = this.props
      await this.sftp[type](remotePath, localPath, {}, this.onData).catch(this.onError)
    }
  }

  cancel = () => {
    this.sftp.close()
    let {id} = this.props.transport
    let transports = copy(this.props.transports).filter(t => {
      return t.id !== id
    })
    this.props.modifier({
      transports
    })
  }

  render() {
    let {localPath, remotePath, type, percent, status} = this.props.transport
    let icon = typeIconMap[type]
    let icon2 = typeIconMap2[type]
    return (
      <div className="sftp-transport">
        <Icon type={icon} className="sftp-type-icon" />
        <span className="sftp-file sftp-local-file">{localPath}</span>
        <Icon type={icon2} className="sftp-direction-icon" />
        <span className="sftp-file sftp-remote-file">{remotePath}</span>
        <Progress
          type="circle"
          className="sftp-file-percent"
          width={30}
          percent={percent}
          status={status}
        />
        <Icon
          type="close-circle"
          className="sftp-stop-icon"
          onClick={this.cancel}
          title="cancel"
        />
      </div>
    )
  }
}
