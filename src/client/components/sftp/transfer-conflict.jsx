/**
 * pass transfer list from props
 * when list changes, do transfer and other op
 */

import { useRef, useEffect } from 'react'
import { useDelta, useConditionalEffect } from 'react-delta'
import { maxTransport } from '../../common/constants'
import { getLocalFileInfo, getRemoteFileInfo, getFolderFromFilePath, getFileExt } from './file-read'
import copy from 'json-deep-copy'
import _ from 'lodash'
import { nanoid as generate } from 'nanoid/non-secure'
import resolve from '../../common/resolve'
import eq from 'fast-deep-equal'

export default (props) => {
  const { transferList } = props
  const delta = useDelta(transferList)
  const currentId = useRef('')
  const timer = useRef(null)
  const onConfirm = useRef(false)
  const ref = {}

  ref.localCheckExist = (path) => {
    return getLocalFileInfo(path)
  }

  ref.remoteCheckExist = (path) => {
    const { sftp } = props
    return getRemoteFileInfo(sftp, path)
      .then(r => r)
      .catch(() => false)
  }

  const checkExist = (type, path) => {
    return ref[type + 'CheckExist'](path)
  }

  function rename (tr, action, _renameId) {
    const { path, name } = getFolderFromFilePath(tr.toPath)
    const { base, ext } = getFileExt(name)
    const renameId = _renameId || generate()
    const newName = ext
      ? `${base}(rename-${renameId}).${ext}`
      : `${base}(rename-${renameId})`
    const res = {
      ...tr,
      renameId,
      toPath: resolve(path, newName)
    }
    if (action) {
      res.action = action
    }
    return res
  }

  function updateTransferAction (data) {
    const {
      id,
      action,
      transfer
    } = data
    const {
      fromFile
    } = transfer
    clear()
    props.modifier((old) => {
      let transferList = copy(old.transferList)
      const index = _.findIndex(transferList, d => d.id === id)
      if (index < 0) {
        return {
          transferList
        }
      }
      transferList[index].fromFile = fromFile
      transferList[index].action = action
      if (action === 'skip') {
        transferList.splice(index, 1)
      } else if (action === 'cancel') {
        transferList = transferList.slice(0, index)
      } else if (action.includes('All')) {
        transferList = transferList.map((t, i) => {
          if (i < index) {
            return t
          }
          return {
            ...t,
            action: action.replace('All', '')
          }
        })
      }
      if (action.includes('rename')) {
        transferList[index] = rename(transferList[index])
      }
      return {
        transferList
      }
    })
  }

  function tagTransferError (id, errorMsg) {
    const tr = _.find(transferList, d => d.id === id)
    props.store.addTransferHistory({
      ...tr,
      host: props.host,
      error: errorMsg,
      finishTime: +new Date()
    })
    props.modifier(old => {
      const transferList = copy(old.transferList)
      const index = _.findIndex(transferList, d => d.id === id)
      if (index >= 0) {
        transferList.splice(index, 1)
      }
      return {
        transferList
      }
    })
  }

  function setConflict (tr) {
    if (props.transferToConfirm) {
      return
    }
    props.modifier({
      transferToConfirm: tr
    })
  }

  function onDecision (event) {
    if (event && event.data && event.data.id === currentId.current) {
      // const {
      //   transferGroupId,
      //   fileId,
      //   id,
      //   action
      // } = event.data
      currentId.current = ''
      updateTransferAction(event.data)
      onConfirm.current = false
      window.removeEventListener('message', onDecision)
    }
  }

  function waitForSignal () {
    window.addEventListener('message', onDecision)
  }

  function setCanTransfer (fromFile, tr) {
    clear()
    props.modifier((old) => {
      const transferList = copy(old.transferList)
      const index = _.findIndex(transferList, t => {
        return t.id === tr.id
      })
      if (index >= 0) {
        transferList[index].action = 'transfer'
        transferList[index].fromFile = fromFile
      }
      return {
        transferList
      }
    })
  }

  async function expand (fromFile, tr) {
    const { type } = fromFile
    let list = await props[type + 'List'](
      true, tr.fromPath
    )
    list = list.map(t => {
      return {
        typeFrom: tr.typeFrom,
        typeTo: tr.typeTo,
        fromPath: resolve(t.path, t.name),
        toPath: resolve(tr.toPath, t.name),
        id: generate(),
        parentId: tr.id
      }
    })
    clear()
    props.modifier((old) => {
      const transferList = copy(old.transferList)
      const index = _.findIndex(transferList, t => {
        return t.id === tr.id
      })
      transferList.splice(index + 1, 0, ...list)
      if (transferList[index]) {
        transferList[index].expanded = true
      }
      return {
        transferList
      }
    })
  }

  function clear () {
    currentId.current = ''
  }
  async function watchFile () {
    if (!transferList.length && currentId.current) {
      return clear()
    }
    const tr = transferList
      .filter(t => {
        return (
          !t.action ||
          !t.fromFile ||
          (t.fromFile.isDirectory && !t.expanded)
        )
      })[0]
    if (!tr) {
      onConfirm.current = false
      return clear()
    }
    if (currentId.current) {
      return null
    }
    currentId.current = tr.id
    const {
      typeFrom,
      typeTo,
      fromPath,
      toPath,
      id,
      action,
      expanded,
      renameId,
      parentId
    } = tr
    const fromFile = tr.fromFile
      ? tr.fromFile
      : await checkExist(typeFrom, fromPath)
    if (!fromFile) {
      currentId.current = ''
      return tagTransferError(id, 'file not exist')
    }
    let toFile = false
    if (renameId || parentId) {
      toFile = false
    } else if (fromPath === toPath) {
      toFile = true
    } else {
      toFile = await checkExist(typeTo, toPath)
    }
    if (fromPath === toPath) {
      return updateTransferAction({
        id,
        action: 'rename',
        transfer: {
          ...tr,
          operation: 'cp',
          fromFile
        }
      })
    } else if (toFile && !action) {
      waitForSignal(id)
      if (!onConfirm.current) {
        onConfirm.current = true
        return setConflict({
          ...tr,
          fromFile,
          toFile
        })
      }
    } else if (toFile && !tr.fromFile && action) {
      return updateTransferAction({
        id,
        action,
        transfer: {
          ...tr,
          fromFile
        }
      })
    } else if (
      fromFile.isDirectory &&
      !expanded &&
      typeFrom !== typeTo &&
      transferList.filter(t => t.fromFile).length < maxTransport
    ) {
      return expand(fromFile, tr)
    }
    setCanTransfer(fromFile, tr)
  }
  useConditionalEffect(() => {
    watchFile()
    return () => {
      clearTimeout(timer.current)
    }
  }, delta && delta.prev && !eq(delta.prev, delta.curr))
  function unwatch () {
    window.removeEventListener('message', onTransferEvent)
  }
  function onTransferEvent (e) {
    const {
      data = {}
    } = e || {}
    if (
      data.type === 'add-transfer' &&
      data.sessionId === props.sessionId
    ) {
      props.addTransferList(data.transfers)
    }
  }
  function watchEvent () {
    window.addEventListener('message', onTransferEvent)
  }
  useEffect(() => {
    watchEvent()
    return unwatch
  }, [])
  return null
}
