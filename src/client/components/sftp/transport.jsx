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
    const before = this.props.currentTransports
    const after = prevProps.currentTransports
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
    const action = _.get(e, 'data.action')
    const ids = _.get(e, 'data.ids')
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
      const transports = copy(old.transports)
      const index = _.findIndex(transports, t => t.id === transport.id)
      transports.splice(index, 1, transport)
      return {
        transports
      }
    })
  }

  pause = () => {
    const transport = copy(this.props.transport)
    transport.pausing = true
    this.transport && this.transport.pause()
    this.update(transport)
  }

  resume = () => {
    const transport = copy(this.props.transport)
    transport.pausing = false
    this.update(transport)
    this.transport && this.transport.resume()
  }

  onData = (transferred) => {
    if (this.onCancel) {
      return
    }
    const transport = copy(this.props.transport)
    const total = transport.file.size
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
    const transport = copy(this.props.transport)
    transport.status = 'exception'
    this.update(transport)
    this.props.store.onError(e)
  }

  onEnd = () => {
    if (this.onCancel) {
      return
    }
    const {
      transferType, id,
      fromPath,
      toPath,
      file,
      targetTransferType,
      srcTransferType
    } = this.props.transport
    const cb = this.props[targetTransferType + 'List']
    const { startTime } = this
    const finishTime = +new Date()
    const { size } = file
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
    const {
      transferType,
      toPath
    } = transport
    const isDown = transferType === transferTypeMap.download
    if (isDown) {
      return fs.mkdirAsync(toPath)
        .catch(this.onError)
    }
    return this.props.sftp.mkdir(toPath)
      .catch(this.onError)
  }

  startTransfer = async () => {
    const { currentTransports } = this.props
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
    const cids = currentTransports.map(t => t.id)
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
      const isDown = transferType === transferTypeMap.download
      const localPath = isDown
        ? toPath
        : fromPath
      const remotePath = isDown
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
    const { id } = this.props.transport
    this.props.modifier((old) => {
      const oldTrans = copy(old.transports)
      const transports = oldTrans.filter(t => {
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
    const { index, transports, currentTransports } = this.props
    const { path } = file
    let shouldHide = false
    const ids = currentTransports.map(c => c.id)
    for (let i = index - 1; i >= 0; i--) {
      const t = transports[i] || {}
      const p = _.get(t, 'file.path') || ''
      const name = _.get(t, 'file.name') || ''
      const pp = resolve(p, name)
      const isDirectory = _.get(t, 'file.isDirectory')
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
    const {
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
    const pauseIcon = pausing ? 'play-circle' : 'pause-circle'
    const pauseTitle = pausing ? e('resume') : e('pause')
    const pauseFunc = pausing ? this.resume : this.pause
    const icon = typeIconMap[transferType]
    const icon2 = typeIconMap2[transferType]
    const cls = this.buildCls(file)
    const title = `${e(transferType)}: ${fromPath} -> ${toPath} ${speed || ''} ${percent || 0}%`
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
