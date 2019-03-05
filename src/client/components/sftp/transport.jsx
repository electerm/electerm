/**
 * tranporter
 */
import React from 'react'
import {Icon} from 'antd'
import copy from 'json-deep-copy'
import _ from 'lodash'
import resolve from '../../common/resolve'
import wait from '../../common/wait'
import {transferTypeMap} from '../../common/constants'
import format, {computeLeftTime, computePassedTime} from './transfer-speed-format'
import fs from '../../common/fs'

const {prefix} = window
const e = prefix('sftp')

const typeIconMap = {
  upload: 'arrow-up',
  download: 'arrow-down'
}
const typeIconMap2 = {
  upload: 'swap-right',
  download: 'swap-left'
}

export default class Tranporter extends React.PureComponent {

  componentWillMount() {
    this.startTransfer()
  }

  componentDidUpdate(prevProps) {
    let before = this.props.currentTransport
    let after = prevProps.currentTransport
    if (!_.isEqual(before, after)) {
      this.startTransfer()
    }
  }

  componentWillUnmount() {
    this.transport && this.transport.destroy && this.transport.destroy()
    this.props.onChildDestroy(this.props.transport.id)
    clearTimeout(this.timer)
  }

  update = (transport) => {
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
    this.transport.pause()
    this.update(transport)
  }

  resume = () => {
    let transport = copy(this.props.transport)
    transport.pausing = false
    this.update(transport)
    this.transport.resume()
  }

  onData = (transferred) => {
    if (this.onCancel) {
      return
    }
    let transport = copy(this.props.transport)
    let total = transport.file.size
    let percent = total === 0
      ? 0
      : Math.floor(100 * transferred / total)
    percent = percent >= 100 ? 99 : percent
    transport.percent = percent
    transport.status = 'active'
    transport.speed = format(transferred, this.startTime)
    transport.leftTime = computeLeftTime(transferred, total, this.startTime)
    transport.passedTime = computePassedTime(this.startTime)
    this.update(transport)
  }

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
    let {
      transferType, id,
      fromPath,
      toPath,
      file,
      targetTransferType,
      srcTransferType
    } = this.props.transport
    let cb = this.props[targetTransferType + 'List']
    let {startTime} = this
    let finishTime = +new Date()
    let {size} = file
    this.props.addTransferHistory({
      id,
      fromPath,
      toPath,
      targetTransferType,
      srcTransferType,
      startTime,
      finishTime,
      type: transferType,
      size: file.size,
      speed: format(size, startTime)
    })
    this.timer = setTimeout(
      () => this.cancel(cb),
      100
    )
  }

  mkdir = async (transport) => {
    let {
      transferType,
      toPath
    } = transport
    let isDown = transferType === transferTypeMap.download
    if (isDown) {
      return fs.mkdirAsync(toPath)
        .catch(this.onError)
    }
    return this.props.sftp.mkdir(toPath)
      .catch(this.onError)
  }

  startTransfer = async () => {
    let {id} = this.props.transport
    let {currentTransport} = this.props
    if (
      _.get(currentTransport, 'id') === id && !this.started
    ) {
      this.started = true
      this.startTime = +new Date()
      let {
        transferType,
        fromPath,
        toPath,
        file: {
          isDirectory,
          mode
        }
      } = this.props.transport
      if (isDirectory) {
        return this.mkdir(this.props.transport)
          .then(this.onEnd)
          .catch(this.onError)
      }
      let isDown = transferType === transferTypeMap.download
      let localPath = isDown
        ? toPath
        : fromPath
      let remotePath = isDown
        ? fromPath
        : toPath
      this.transport = await this.props.sftp[transferType]({
        remotePath,
        localPath,
        options: {mode},
        ..._.pick(this, [
          'onData',
          'onError',
          'onEnd'
        ])
      })
    }
  }

  cancel = async (callback) => {
    this.onCancel = true
    let {id} = this.props.transport
    let oldTrans = copy(this.props.transports)
    if (oldTrans.length === 1) {
      if (this.transport) {
        await this.transport.pause()
      }
      await wait(150)
    }
    let transports = oldTrans.filter(t => {
      return t.id !== id
    })
    this.props.modifier({
      transports
    }, _.isFunction(callback) ? callback : undefined)
  }

  buildCls(file = {}) {
    let {index, transports, currentTransport} = this.props
    let {path} = file
    let shouldHide = false
    for (let i = index - 1;i >= 0;i --) {
      let t = transports[i] || {}
      let p = _.get(t, 'file.path') || ''
      let name = _.get(t, 'file.name') || ''
      let pp = resolve(p, name)
      let isDirectory = _.get(t, 'file.isDirectory')
      if (
        path.startsWith(pp) &&
        isDirectory &&
        currentTransport.id !== t.id
      ) {
        shouldHide = false
      }
    }
    return `sftp-transport mg1b pd1x ${shouldHide ? 'hide' : ''}`
  }

  render() {
    let {
      fromPath,
      toPath,
      transferType,
      percent,
      status,
      speed,
      pausing = false,
      leftTime,
      passedTime,
      file
    } = this.props.transport
    let pauseIcon = pausing ? 'play-circle' : 'pause-circle'
    let pauseTitle = pausing ? e('resume') : e('pause')
    let pauseFunc = pausing ? this.resume : this.pause
    let icon = typeIconMap[transferType]
    let icon2 = typeIconMap2[transferType]
    let cls = this.buildCls(file)
    let title = `${e(transferType)}: ${fromPath} -> ${toPath} ${speed || ''} ${percent || 0}%`
    return (
      <div className={cls} title={title}>
        <Icon type={icon} className="sftp-type-icon iblock mg1r color-blue" />
        <span
          className="sftp-file sftp-local-file elli width200 iblock"
          title={fromPath}
        >{fromPath}</span>
        <Icon type={icon2} className="sftp-direction-icon mg1x iblock" />
        <span
          className="sftp-file sftp-remote-file elli mg1r width200 iblock"
        >{toPath}</span>
        <span
          className={`sftp-file-percent mg1r iblock sftp-status-${status}`}
        >
          {percent || 0}%
          {speed ? `(${speed})` : null}
        </span>
        <span
          className={`sftp-file-percent mg1r iblock sftp-status-${status}`}
        >
          {passedTime || '-'}|{leftTime || '-'}
        </span>
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
          title={e('cancel')}
        />
      </div>
    )
  }
}
