/**
 * file props
 */

import { memo } from 'react'
import { Icon, Modal } from 'antd'
import resolve from '../../common/resolve'
import { mode2permission } from '../../common/mode2permission'
import time from '../../common/time'
import renderPermission from './permission-render'

const { prefix } = window
const e = prefix('sftp')
const formatTime = time

export default memo(props => {
  const {
    visible,
    file,
    tab,
    onClose
  } = props
  if (!visible) {
    return null
  }
  const {
    name,
    size,
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
    visible,
    width: 500,
    title: e(iconType) + ` ${e('attributes')}`,
    footer: null,
    onCancel: onClose
  }
  const fp = resolve(path, name)
  const ffp = type === 'local'
    ? fp
    : `${username}@${host}:${port}:${fp}`
  const perms = mode2permission(mode)
  return (
    <Modal
      {...ps}
    >
      <div className='file-props-wrap relative'>
        <Icon type={iconType} className='file-icon' />
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
          <p className='pd1b'>{size}</p>
          <p className='bold'>{e('accessTime')}:</p>
          <p className='pd1b'>{formatTime(accessTime)}</p>
          <p className='bold'>{e('modifyTime')}:</p>
          <p className='pd1b'>{formatTime(modifyTime)}</p>
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
})
