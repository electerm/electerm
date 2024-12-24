/**
 * file props
 */

import React from 'react'
import { Modal, Button } from 'antd'
import resolve from '../../common/resolve'
import time from '../../common/time'
import { update } from 'lodash-es'
import { mode2permission, permission2mode } from '../../common/mode2permission'
import { commonActions } from '../../common/constants'
import renderPermission from './permission-render'
import postMessage from '../../common/post-msg'
import FileIcon from './file-icon'

const e = window.translate
const formatTime = time

export default class FileMode extends React.PureComponent {
  state = {
    data: {},
    file: {}
  }

  componentDidMount () {
    window.addEventListener('message', this.onEvent)
  }

  setStateProxy = (state, cb) => {
    if (state && typeof state.file !== 'undefined') {
      postMessage({
        action: commonActions.updateStore,
        value: !!state.file.id,
        prop: 'showFileModal'
      })
    }
    return this.setState(state, cb)
  }

  onEvent = (e) => {
    const {
      action,
      data,
      file
    } = e.data || {}
    if (action === commonActions.showFileModeModal) {
      this.setStateProxy({
        data,
        file
      })
    }
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
    postMessage({
      action: commonActions.submitFileModeClose
    })
    this.setStateProxy({
      file: {},
      data: {}
    })
  }

  handleSubmit = () => {
    postMessage({
      action: commonActions.submitFileModeEdit,
      file: this.state.file
    })
    this.onClose()
  }

  renderFooter () {
    return (
      <Button
        type='primary'
        onClick={this.handleSubmit}
      >
        {e('submit')}
      </Button>
    )
  }

  render () {
    const {
      visible,
      tab,
      uidTree,
      gidTree
    } = this.state.data
    if (!visible) {
      return null
    }
    const { file } = this.state
    const {
      name,
      size,
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
    const ps = {
      open: visible,
      width: 500,
      title: `${e('edit')} ` + e(iconType) + ` ${e('permission')}`,
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
            <p className='bold'>{e('size')}:</p>
            <p className='pd1b'>{size}</p>
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
