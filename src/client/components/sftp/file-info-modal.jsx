/**
 * file props
 */

import React from 'react'
import { Modal, Button } from 'antd'
import resolve from '../../common/resolve'
import time from '../../common/time'
import { update } from 'lodash-es'
import { mode2permission, permission2mode } from '../../common/mode2permission'
import renderPermission from './permission-render'
import FileIcon from './file-icon'
import fs from '../../common/fs'
import { filesize } from 'filesize'
import { runCmd } from '../terminal/terminal-apis'
import {
  isWin,
  typeMap
} from '../../common/constants'
import { refsStatic, refs } from '../common/ref'

const e = window.translate
const formatTime = time

export default class FileMode extends React.PureComponent {
  state = {
    fileId: '',
    loading: false,
    tab: null,
    pid: '',
    sessionId: '',
    size: 0,
    file: {},
    editPermission: false
  }

  componentDidMount () {
    refsStatic.add('file-modal', this)
  }

  setStateProxy = (state, cb) => {
    if (state && typeof state.file !== 'undefined') {
      window.store.showFileModal = !!state.file.id
    }
    return this.setState(state, cb)
  }

  showFileInfoModal (data) {
    this.setStateProxy({
      ...data,
      size: 0,
      editPermission: false
    })
  }

  showFileModeModal = (data, file, fileId) => {
    this.setStateProxy({
      ...data,
      file: this.addPermission(file),
      fileId,
      editPermission: true
    })
  }

  addPermission = file => {
    const perms = mode2permission(file.mode)
    const permission = permission2mode(perms)
    const mode = Number('0o' + '10' + permission)
    return {
      ...file,
      permission,
      mode
    }
  }

  onChangePermission = (name, permName) => {
    if (!this.state.editPermission) {
      return
    }
    const { file } = this.state
    const perms = mode2permission(file.mode)
    const i = perms.findIndex(p => p.name === name)
    update(
      perms,
      `[${i}].permission.${permName}`,
      b => !b
    )
    const permission = permission2mode(perms)
    const mode = Number('0o' + '10' + permission)
    this.setStateProxy({
      file: {
        ...file,
        permission,
        mode
      }
    })
  }

  onClose = () => {
    this.setStateProxy({
      file: {},
      visible: false
    })
  }

  getSize = (str = '') => {
    if (isWin) {
      const s = (str.stdout || '').split('\n').find(s => s.trim().startsWith('Sum'))
      return s ? filesize(parseInt((s.split(':')[1]).trim(), 10)) : 0
    } else {
      return str.split(/\s+/)[0]
    }
  }

  calcLocal = async (folder) => {
    const cmd = isWin
      ? `Get-ChildItem -Recurse '${folder}' | Measure-Object -Property Length -Sum`
      : `du -sh '${folder}'`
    const func = isWin ? 'runWinCmd' : 'run'
    const res = await fs[func](cmd).catch(window.store.onError)
    return this.getSize(res)
  }

  calcRemote = async (folder) => {
    const cmd = `du -sh '${folder}'`
    const r = await runCmd(
      this.state.pid,
      this.state.sessionId,
      cmd
    ).catch(window.store.onError)
    return r ? r.split(/\s+/)[0] : 0
  }

  handleCalc = async () => {
    const { file } = this.state
    const { type, path, name } = file
    this.setStateProxy({
      loading: true
    })
    const fp = resolve(path, name)
    const size = type === typeMap.local
      ? await this.calcLocal(fp)
      : await this.calcRemote(fp)
    this.setState({
      loading: false,
      size
    })
  }

  handleSubmit = () => {
    refs.get(this.state.fileId)?.changeFileMode(this.state.file)
    this.onClose()
  }

  renderFooter () {
    if (!this.state.editPermission) {
      return null
    }
    return (
      <Button
        type='primary'
        onClick={this.handleSubmit}
      >
        {e('submit')}
      </Button>
    )
  }

  getFileSize = () => {
    const { isDirectory, size } = this.state.file
    if (isDirectory) {
      return this.state.size || 0
    }
    return size
  }

  renderSizeRow = () => {
    const size = this.getFileSize()
    if (this.state.editPermission) {
      return (
        <>
          <p className='bold'>{e('size')}:</p>
          <p className='pd1b'>{size}</p>
        </>
      )
    }
    return (
      <>
        <p className='bold'>{e('size')}:</p>
        <p className='pd1b'>{this.getFileSize()}{this.renderCalc()}</p>
      </>
    )
  }

  renderCalc () {
    const { isDirectory } = this.state.file
    if (isDirectory) {
      const { loading } = this.state
      return (
        <Button
          onClick={this.handleCalc}
          loading={loading}
          disabled={loading}
          className='mg1l'
        >
          {e('calculate')}
        </Button>
      )
    }
  }

  render () {
    const {
      visible,
      tab,
      uidTree,
      gidTree,
      file,
      editPermission
    } = this.state
    if (!visible) {
      return null
    }
    const {
      name,
      accessTime,
      modifyTime,
      isDirectory,
      isSymbolicLink,
      path,
      mode,
      type,
      owner,
      group
    } = file
    const {
      host,
      port,
      username
    } = tab
    const iconType = isDirectory ? 'folder' : 'file'
    const title = editPermission
      ? `${e('edit')} ` + e(iconType) + ` ${e('permission')}`
      : e(iconType) + ` ${e('attributes')}`
    const ps = {
      open: visible,
      width: 500,
      title,
      footer: this.renderFooter(),
      onCancel: this.onClose
    }
    const fp = resolve(path, name)
    const ffp = type === 'local'
      ? fp
      : `${username}@${host}:${port}:${fp}`

    const perms = mode2permission(mode)
    const permission = permission2mode(perms)

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
            <p className='bold'>{e('mode')}: ({permission})</p>
            <div className='pd1b'>
              {
                perms.map((perm) => {
                  return renderPermission(
                    perm,
                    this.onChangePermission
                  )
                })
              }
            </div>
            <p className='bold'>{e('fullPath')}:</p>
            <p className='pd1b'>{ffp}</p>
            <p className='bold'>{e('owner')}</p>
            <p className='pd1b'>{uidTree['' + owner]}</p>
            <p className='bold'>{e('group')}</p>
            <p className='pd1b'>{gidTree['' + group]}</p>
            {this.renderSizeRow()}
            <p className='bold'>{e('accessTime')}:</p>
            <p className='pd1b'>{formatTime(accessTime)}</p>
            <p className='bold'>{e('modifyTime')}:</p>
            <p className='pd1b'>{formatTime(modifyTime)}</p>
          </div>
        </div>
      </Modal>
    )
  }
}
