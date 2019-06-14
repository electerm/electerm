/**
 * tranporter
 */
import React from 'react'
import { Icon } from 'antd'
import copy from 'json-deep-copy'
import _ from 'lodash'
import resolve from '../../common/resolve'
import { transferTypeMap } from '../../common/constants'
import format, { computeLeftTime, computePassedTime } from './transfer-speed-format'
import fs from '../../common/fs'
import { transportTypes } from './transport-types'

const { prefix } = window
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
  componentDidMount () {
    this.initEvent()
    this.startTransfer()
  }

  componentDidUpdate (prevProps) {
    let before = this.props.currentTransports
    let after = prevProps.currentTransports
    if (!_.isEqual(before, after)) {
      this.startTransfer()
    }
  }

  componentWillUnmount () {
    window.removeEventListener('message', this.onMessage)
    this.transport && this.transport.destroy && this.transport.destroy()
    clearTimeout(this.timer)
  }

  initEvent = () => {
    window.addEventListener('message', this.onMessage)
  }

  onMessage = (e) => {
    let action = _.get(e, 'data.action')
    let ids = _.get(e, 'data.ids')
    if (!ids || !ids.includes(this.props.transport.id)) {
      return
    }
    if (
      action === transportTypes.pauseTransport
    ) {
      this.pause()
    } else if (action === transportTypes.resumeTransport) {
      this.resume()
    } else if (action === transportTypes.cancelTransport) {
      this.cancel()
    }
  }

  update = (transport) => {
    this.props.modifier((old) => {
      let transports = copy(old.transports)
      let index = _.findIndex(transports, t => t.id === transport.id)
      transports.splice(index, 1, transport)
      return {
        transports
      }
    })
  }

  pause = () => {
    let transport = copy(this.props.transport)
    transport.pausing = true
    this.transport && this.transport.pause()
    this.update(transport)
  }

  resume = () => {
    let transport = copy(this.props.transport)
    transport.pausing = false
    this.update(transport)
    this.transport && this.transport.resume()
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
    transport.transferred = transferred
    transport.speed = format(transferred, this.startTime)
    Object.assign(
      transport,
      computeLeftTime(transferred, total, this.startTime)
    )
    transport.passedTime = computePassedTime(this.startTime)
    this.update(transport)
  }

  onError = e => {
    let transport = copy(this.props.transport)
    transport.status = 'exception'
    this.update(transport)
    this.props.store.onError(e)
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
    let { startTime } = this
    let finishTime = +new Date()
    let { size } = file
    if (!this.props.config.disableTransferHistory) {
      this.props.store.addTransferHistory({
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
    }
    this.cancel(cb)
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
    let { currentTransports } = this.props
    let {
      id,
      transferType,
      fromPath,
      toPath,
      file: {
        isDirectory,
        targetFile,
        mode
      }
    } = this.props.transport
    let cids = currentTransports.map(t => t.id)
    if (
      cids.includes(id) && !this.started
    ) {
      this.started = true
      this.startTime = +new Date()
      mode = _.get(targetFile, 'mode') || mode
      if (isDirectory) {
        return this.mkdir(this.props.transport)
          .then(this.onEnd)
          .catch(this.onError)
      }
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
        options: { mode },
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
    let { id } = this.props.transport
    this.props.modifier((old) => {
      let oldTrans = copy(old.transports)
      let transports = oldTrans.filter(t => {
        return t.id !== id
      })
      if (!transports.length) {
        this.props.store.editTab(this.props.tab.id, {
          isTransporting: false
        })
      }
      return {
        transports
      }
    }, _.isFunction(callback) ? callback : undefined)
  }

  buildCls (file = {}) {
    let { index, transports, currentTransports } = this.props
    let { path } = file
    let shouldHide = false
    let ids = currentTransports.map(c => c.id)
    for (let i = index - 1; i >= 0; i--) {
      let t = transports[i] || {}
      let p = _.get(t, 'file.path') || ''
      let name = _.get(t, 'file.name') || ''
      let pp = resolve(p, name)
      let isDirectory = _.get(t, 'file.isDirectory')
      if (
        path.startsWith(pp) &&
        isDirectory &&
        !ids.includes(t.id)
      ) {
        shouldHide = false
      }
    }
    return `sftp-transport mg1b pd1x ${shouldHide ? 'hide' : ''}`
  }

  render () {
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
        <Icon type={icon} className='sftp-type-icon iblock mg1r color-blue' />
        <span
          className='sftp-file sftp-local-file elli width200 iblock'
          title={fromPath}
        >{fromPath}</span>
        <Icon type={icon2} className='sftp-direction-icon mg1x iblock' />
        <span
          className='sftp-file sftp-remote-file elli mg1r width200 iblock'
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
          className='transfer-control-icon iblock pointer mg1r hover-black'
          onClick={pauseFunc}
          title={pauseTitle}
        />
        <Icon
          type='close-circle'
          className='transfer-control-icon iblock pointer hover-black'
          onClick={this.cancel}
          title={e('cancel')}
        />
      </div>
    )
  }
}
