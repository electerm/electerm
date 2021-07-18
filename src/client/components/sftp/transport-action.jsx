import { useEffect, useRef } from 'react'
import { useDelta, useConditionalEffect } from 'react-delta'
import copy from 'json-deep-copy'
import _ from 'lodash'
import { nanoid as generate } from 'nanoid/non-secure'
import TransportItem from './transport-ui'
import { typeMap, transferTypeMap } from '../../common/constants'
import fs from '../../common/fs'
import { transportTypes } from './transport-types'
import format, { computeLeftTime, computePassedTime } from './transfer-speed-format'
import { getFolderFromFilePath } from './file-read'
import resolve from '../../common/resolve'
import { zipCmd, unzipCmd, rmCmd } from './zip'

export default function transportAction (props) {
  const { transfer } = props
  const inst = useRef({})
  const unzipping = useRef(false)
  const initRef = useDelta(transfer.inited)
  const initRefExpand = useDelta(transfer.expaned)
  function update (up) {
    props.modifier((old) => {
      const transferList = copy(old.transferList)
      const index = _.findIndex(transferList, t => t.id === transfer.id)
      if (index < 0) {
        return {
          transferList
        }
      }
      Object.assign(transferList[index], up)
      return {
        transferList
      }
    })
  }
  function insert (insts) {
    props.modifier((old) => {
      const transferList = copy(old.transferList)
      const index = _.findIndex(transferList, t => t.id === transfer.id)
      transferList.splice(index, 1, ...insts)
      return {
        transferList
      }
    })
  }
  function onEnd () {
    if (inst.current.onCancel) {
      return
    }
    const {
      typeTo,
      next
    } = transfer
    const cb = props[typeTo + 'List']
    const finishTime = +new Date()
    if (!props.config.disableTransferHistory) {
      props.store.addTransferHistory(
        {
          ...transfer,
          finishTime,
          startTime: inst.current.startTime,
          speed: format(transfer.fromFile.size, inst.current.startTime),
          host: props.tab.host
        }
      )
    }
    if (next) {
      insert([copy(next)])
    }
    cancel(cb)
  }
  function onData (transferred) {
    if (inst.current.onCancel) {
      return
    }
    const up = {}
    const total = transfer.fromFile.size
    let percent = total === 0
      ? 0
      : Math.floor(100 * transferred / total)
    percent = percent >= 100 ? 99 : percent
    up.percent = percent
    up.status = 'active'
    up.transferred = transferred
    up.startTime = inst.current.startTime
    up.speed = format(transferred, up.startTime)
    Object.assign(
      up,
      computeLeftTime(transferred, total, up.startTime)
    )
    up.passedTime = computePassedTime(up.startTime)
    update(up)
  }
  function cancel (callback) {
    if (inst.current.onCancel) {
      return
    }
    inst.current.onCancel = true
    const { id } = transfer
    inst.current.transport && inst.current.transport.destroy()
    props.modifier((old) => {
      const oldTrans = copy(old.transferList)
      const transferList = oldTrans.filter(t => {
        return t.id !== id
      })
      if (!transferList.length) {
        props.store.editTab(props.tab.id, {
          isTransporting: false
        })
      }
      return {
        transferList
      }
    }, _.isFunction(callback) ? callback : _.noop)
  }

  function pause () {
    inst.current.transport && inst.current.transport.pause()
    update({
      pausing: true
    })
  }

  function resume () {
    update({
      pausing: false
    })
    inst.current.transport && inst.current.transport.resume()
  }

  function handlePauseOrResume () {
    if (transfer.pausing) {
      resume()
    } else {
      pause()
    }
  }

  function onMessage (e) {
    const action = _.get(e, 'data.action')
    const ids = _.get(e, 'data.ids')
    if (
      (ids && ids.includes(transfer.id)) ||
      (ids && ids.length === 0)
    ) {
      if (
        action === transportTypes.pauseTransport
      ) {
        pause()
      } else if (action === transportTypes.resumeTransport) {
        resume()
      } else if (action === transportTypes.cancelTransport) {
        cancel()
      }
    }
  }
  function initEvent () {
    window.addEventListener('message', onMessage)
  }
  function onDestroy () {
    window.removeEventListener('message', onMessage)
  }
  function mvOrCp () {
    const {
      fromPath,
      toPath,
      typeFrom,
      operation // 'mv' or 'cp'
    } = transfer
    if (typeFrom === typeMap.local) {
      return fs[operation](fromPath, toPath)
        .then(onEnd)
        .catch(e => {
          onEnd()
          onError(e)
        })
    }
    return props.sftp[operation](fromPath, toPath)
      .then(onEnd)
      .catch(e => {
        onEnd()
        onError(e)
      })
  }
  async function zipTransfer () {
    const {
      fromPath,
      toPath,
      typeFrom
    } = transfer
    let p
    let isFromRemote
    if (typeFrom === typeMap.local) {
      isFromRemote = false
      p = await fs.zipFolder(fromPath)
    } else {
      isFromRemote = true
      p = await zipCmd(props.pid, props.sessionId, fromPath)
    }
    const { name } = getFolderFromFilePath(p, isFromRemote)
    const { path } = getFolderFromFilePath(toPath, !isFromRemote)
    const nTo = resolve(path, name)
    const newTrans1 = {
      ...copy(transfer),
      toPath: nTo,
      fromPath: p,

      id: generate()
    }
    delete newTrans1.fromFile
    delete newTrans1.inited
    delete newTrans1.zip
    const newTrans2 = copy(newTrans1)
    newTrans2.unzip = true
    newTrans2.id = generate()
    newTrans1.next = newTrans2
    insert([newTrans1])
  }

  async function unzipFile () {
    if (unzipping.current) {
      return false
    }
    unzipping.current = true
    const {
      fromPath,
      toPath,
      typeTo
    } = transfer
    const isToRemote = typeTo === typeMap.remote
    const { path } = getFolderFromFilePath(toPath, isToRemote)
    if (isToRemote) {
      await unzipCmd(props.pid, props.sessionId, toPath, path)
    } else {
      await fs.unzipFile(toPath, path)
    }
    await rmCmd(props.pid, props.sessionId, !isToRemote ? fromPath : toPath)
    await fs.rmrf(!isToRemote ? toPath : fromPath)
    onEnd()
  }

  async function doTransfer () {
    const {
      fromPath,
      toPath,
      typeFrom,
      fromFile: {
        mode: fromMode
      },
      toFile = {}
    } = transfer
    const transferType = typeFrom === typeMap.local ? transferTypeMap.upload : transferTypeMap.download
    const isDown = transferType === transferTypeMap.download
    const localPath = isDown
      ? toPath
      : fromPath
    const remotePath = isDown
      ? fromPath
      : toPath
    const mode = toFile.mode || fromMode
    inst.current.transport = await props.sftp[transferType]({
      remotePath,
      localPath,
      options: { mode },
      onData,
      onError,
      onEnd
    })
  }
  function isTransferAction (action) {
    return action.includes('rename') || action === 'transfer'
  }
  async function initTransfer () {
    if (inst.current.started) {
      return
    }
    props.store.editTab(props.tab.id, {
      isTransporting: true
    })
    const {
      typeFrom,
      typeTo,
      fromFile: {
        isDirectory
      },
      action,
      expanded,
      zip,
      unzip,
      inited
    } = transfer
    const t = +new Date()
    update({
      startTime: t
    })
    inst.current.startTime = t
    inst.current.started = true
    if (unzip && inited) {
      unzipFile()
    } else if (zip && inited) {
      zipTransfer()
    } else if (typeFrom === typeTo) {
      return mvOrCp()
    } else if (isDirectory && expanded && isTransferAction(action)) {
      return mkdir()
        .then(onEnd)
        .catch(onError)
    } else if (!isDirectory) {
      doTransfer()
    } else if (expanded && isDirectory && !isTransferAction(action)) {
      cancel()
    }
  }
  function onError (e) {
    const up = {
      status: 'exception',
      error: e.message
    }
    update(up)
    props.store.onError(e)
  }
  async function mkdir () {
    const {
      typeTo,
      toPath
    } = transfer
    if (typeTo === typeMap.local) {
      return fs.mkdirAsync(toPath)
        .catch(onError)
    }
    return props.sftp.mkdir(toPath)
      .catch(onError)
  }
  useEffect(() => {
    initEvent()
    if (props.transfer.inited) {
      initTransfer()
    }
    return onDestroy
  }, [])
  useConditionalEffect(() => {
    initTransfer()
  }, initRef && initRef.prev !== initRef.curr && initRef.curr === true)
  useConditionalEffect(() => {
    initTransfer()
  }, initRefExpand && initRefExpand.prev !== initRefExpand.curr && initRef.curr === true)
  return (
    <TransportItem
      {...props}
      handlePauseOrResume={handlePauseOrResume}
      cancel={cancel}
    />
  )
}
