/**
 * file props
 */

import React from 'react'
import {
  FolderOutlined,
  FileOutlined
} from '@ant-design/icons'
import { Modal, Button } from 'antd'
import resolve from '../../common/resolve'
import time from '../../../app/common/time'
import _ from 'lodash'
import { mode2permission, permission2mode } from '../../common/mode2permission'
import renderPermission from './permission-render'
import copy from 'json-deep-copy'

const { prefix } = window
const e = prefix('sftp')
const formatTime = time

export default class FileMode extends React.PureComponent {
  constructor (props) {
    super(props)
    this.state = {
      file: copy(props.file)
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
    const i = _.findIndex(perms, p => p.name === name)
    _.update(
      perms,
      `[${i}].permission.${permName}`,
      b => !b
    )
    const permission = permission2mode(perms)
    const mode = Number('0o' + '10' + permission)
    this.setState({
      file: {
        ...file,
        permission,
        mode
      }
    })
  }

  onSubmit = () => {
    this.props.changeFileMode(
      this.state.file
    )
  }

  renderFooter () {
    return (
      <Button
        type='primary'
        onClick={this.onSubmit}
      >
        {e('submit')}
      </Button>
    )
  }

  render () {
    const {
      visible,
      tab,
      onClose,
      uidTree,
      gidTree
    } = this.props
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
    const Icon = isDirectory
      ? FolderOutlined
      : FileOutlined
    const ps = {
      visible,
      width: 500,
      title: `${e('edit')} ` + e(iconType) + ` ${e('permission')}`,
      footer: this.renderFooter(),
      onCancel: onClose
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
          <Icon className='file-icon' />
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
