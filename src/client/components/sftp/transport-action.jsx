import { useEffect, useRef } from 'react'
import { useDelta, useConditionalEffect } from 'react-delta'
import copy from 'json-deep-copy'
import { findIndex, isFunction, noop } from 'lodash-es'
import generate from '../../common/uid'
import { typeMap, transferTypeMap } from '../../common/constants'
import fs from '../../common/fs'
import { transportTypes } from './transport-types'
import format, { computeLeftTime, computePassedTime } from './transfer-speed-format'
import { getFolderFromFilePath } from './file-read'
import resolve from '../../common/resolve'
import delay from '../../common/wait'
import { zipCmd, unzipCmd, rmCmd, mvCmd, mkdirCmd } from './zip'
import './transfer.styl'

export default function transportAction (props) {
  const { transfer } = props
  const inst = useRef({})
  const unzipping = useRef(false)
  const initRef = useDelta(transfer.inited)
  const initRefExpand = useDelta(transfer.expaned)
  function update (up) {
    props.modifier((old) => {
      const transferList = copy(old.transferList)
      const index = findIndex(transferList, t => t.id === transfer.id)
      if (index < 0) {
        return {
          transferList
        }
      }
      window.store.editTransfer(
        transferList[index].id,
        up
      )
      Object.assign(transferList[index], up)
      return {
        transferList
      }
    })
  }
  function insert (insts) {
    props.modifier((old) => {
      const transferList = copy(old.transferList)
      const index = findIndex(transferList, t => t.id === transfer.id)
      transferList.splice(index, 1, ...insts)
      window.store.setTransfers(transferList)
      return {
        transferList
      }
    })
  }
  function onEnd (update = {}) {
    if (inst.current.onCancel) {
      return
    }
    const {
      typeTo,
      next
    } = transfer
    const cb = props[typeTo + 'List']
    const finishTime = Date.now()
    if (!props.config.disableTransferHistory) {
      window.store.addTransferHistory(
        {
          ...transfer,
          ...update,
          finishTime,
          startTime: inst.current.startTime,
          size: transfer.fromFile.size,
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
      window.store.setTransfers(transferList)
      return {
        transferList
      }
    }, isFunction(callback) ? callback : noop)
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
    const action = e?.data?.action
    const id = e?.data?.id
    const ids = e?.data?.ids
    if (id === transfer.id) {
      switch (action) {
        case transportTypes.cancelTransport:
          cancel()
          break
        case transportTypes.pauseOrResumeTransfer:
          handlePauseOrResume()
          break
        default:
          break
      }
    }
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
      toPathReal: transfer.toPath,
      fromPathReal: transfer.fromPath,
      toPath: nTo,
      fromPath: p,
      originalId: transfer.id,
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

  function buildUnzipPath (transfer) {
    const {
      newName,
      toPath,
      typeTo,
      oldName
    } = transfer
    const isToRemote = typeTo === typeMap.remote
    const { path } = getFolderFromFilePath(toPath, isToRemote)
    const np = newName
      ? resolve(path, 'temp-' + newName)
      : path
    return {
      targetPath: path,
      path: np,
      name: oldName
    }
  }

  async function unzipFile () {
    if (unzipping.current) {
      return false
    }
    unzipping.current = true
    const {
      fromPath,
      toPath,
      typeTo,
      newName
    } = transfer
    const isToRemote = typeTo === typeMap.remote
    const {
      path,
      name,
      targetPath
    } = buildUnzipPath(transfer)
    if (isToRemote) {
      if (newName) {
        await mkdirCmd(props.pid, props.sessionId, path)
        await delay(1000)
      }
      await unzipCmd(props.pid, props.sessionId, toPath, path)
      if (newName) {
        const mvFrom = resolve(path, name)
        const mvTo = resolve(targetPath, newName)
        await mvCmd(props.pid, props.sessionId, mvFrom, mvTo)
      }
    } else {
      if (newName) {
        await fs.mkdir(path)
      }
      await fs.unzipFile(toPath, path)
      if (newName) {
        const mvFrom = resolve(path, name)
        const mvTo = resolve(targetPath, newName)
        await fs.mv(mvFrom, mvTo)
      }
    }
    await rmCmd(props.pid, props.sessionId, !isToRemote ? fromPath : toPath)
    await fs.rmrf(!isToRemote ? toPath : fromPath)
    if (newName) {
      if (isToRemote) {
        await rmCmd(props.pid, props.sessionId, path)
      } else {
        await fs.rmrf(path)
      }
    }
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
    const t = Date.now()
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
    onEnd(up)
    window.store.onError(e)
  }
  async function mkdir () {
    const {
      typeTo,
      toPath
    } = transfer
    if (typeTo === typeMap.local) {
      return fs.mkdir(toPath)
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
  return null
}
