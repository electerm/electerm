/**
 * file props
 */

import { useState, useEffect } from 'react'
import {
  Modal,
  Button
} from 'antd'
import {
  commonActions,
  isWin,
  typeMap
} from '../../common/constants'
import resolve from '../../common/resolve'
import { mode2permission } from '../../common/mode2permission'
import time from '../../common/time'
import renderPermission from './permission-render'
import FileIcon from './file-icon'
import fs from '../../common/fs'
import { filesize } from 'filesize'
import { runCmd } from '../terminal/terminal-apis'

const e = window.translate
const formatTime = time

export default function FileInfoModal () {
  const [state, setState] = useState({
    loading: false
  })
  function onClose () {
    setState({})
  }
  function onEvent (e) {
    const {
      action,
      data
    } = e.data || {}
    if (action === commonActions.showFileInfoModal) {
      setState(old => {
        return {
          ...old,
          ...data,
          size: 0
        }
      })
    }
  }
  useEffect(() => {
    window.addEventListener('message', onEvent)
  }, [])
  useEffect(() => {
    window.store.showEditor = !!state.visible
  }, [state.visible])
  const {
    visible,
    file,
    tab,
    uidTree = {},
    gidTree = {},
    loading
  } = state
  if (!visible) {
    return null
  }
  const {
    name,
    size,
    owner,
    group,
    accessTime,
    modifyTime,
    isDirectory,
    isSymbolicLink,
    path,
    mode,
    type
  } = file
  const {
    host,
    port,
    username
  } = tab
  const iconType = isDirectory ? 'folder' : 'file'
  const ps = {
    open: visible,
    width: 500,
    title: e(iconType) + ` ${e('attributes')}`,
    footer: null,
    onCancel: onClose
  }
  const fp = resolve(path, name)
  const ffp = type === typeMap.local
    ? fp
    : `${username}@${host}:${port}:${fp}`
  const perms = mode2permission(mode)
  function setLoading (loading) {
    setState(old => {
      return {
        ...old,
        loading
      }
    })
  }
  function renderSize () {
    if (isDirectory) {
      return state.size || 0
    }
    return size
  }
  function getSize (str = '') {
    if (isWin) {
      const s = (str.stdout || '').split('\n').find(s => s.trim().startsWith('Sum'))
      return s ? filesize(parseInt((s.split(':')[1]).trim(), 10)) : 0
    } else {
      return str.split(/\s+/)[0]
    }
  }
  async function calcLocal (folder) {
    const cmd = isWin
      ? `Get-ChildItem -Recurse '${folder}' | Measure-Object -Property Length -Sum`
      : `du -sh '${folder}'`
    const func = isWin ? 'runWinCmd' : 'run'
    const res = await fs[func](cmd).catch(window.store.onError)
    return getSize(res)
  }
  async function calcRemote (folder) {
    const cmd = `du -sh '${folder}'`
    const r = await runCmd(
      state.pid,
      state.sessionId,
      cmd
    ).catch(window.store.onError)
    return r ? r.split(/\s+/)[0] : 0
  }
  async function calc () {
    setLoading(true)
    const size = type === typeMap.local
      ? await calcLocal(fp)
      : await calcRemote(fp)
    setState(old => {
      return {
        ...old,
        loading: false,
        size
      }
    })
  }
  function renderCalc () {
    if (isDirectory) {
      return (
        <Button
          onClick={calc}
          loading={loading}
          disabled={loading}
          className='mg1l'
        >
          {e('calculate')}
        </Button>
      )
    }
  }
  return (
    <Modal
      {...ps}
    >
      <div className='file-props-wrap relative'>
        <FileIcon
          className='file-icon'
          file={file}
          height={50}
        />
        <div className='file-props'>
          <p className='bold'>{e(iconType)} {e('name')}:</p>
          <p className='pd1b'>
            {
              isSymbolicLink
                ? <sup className='color-blue symbolic-link-icon'>*</sup>
                : null
            }
            {name}
          </p>
          <p className='bold'>{e('fullPath')}:</p>
          <p className='pd1b'>{ffp}</p>
          <p className='bold'>{e('size')}:</p>
          <p className='pd1b'>{renderSize()}{renderCalc()}</p>
          <p className='bold'>{e('accessTime')}:</p>
          <p className='pd1b'>{formatTime(accessTime)}</p>
          <p className='bold'>{e('modifyTime')}:</p>
          <p className='pd1b'>{formatTime(modifyTime)}</p>
          <p className='bold'>{e('owner')}</p>
          <p className='pd1b'>{uidTree['' + owner]}</p>
          <p className='bold'>{e('group')}</p>
          <p className='pd1b'>{gidTree['' + group]}</p>
          <p className='bold'>{e('mode')}:</p>
          <div className='pd1b'>
            {
              perms.map(renderPermission)
            }
          </div>
        </div>
      </div>
    </Modal>
  )
}
