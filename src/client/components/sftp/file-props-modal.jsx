/**
 * file props
 */

import {Icon, Modal} from 'antd'
import resolve from '../../common/resolve'
import {mode2permission} from '../../common/mode2permission'
import moment from 'moment'
import renderPermission from './permission-render'

const {prefix} = window
const e = prefix('sftp')
const formatTime = time => {
  return moment(time).format()
}

export default function FileProps (props) {

  let {
    visible = false,
    file = {
      path: '',
      name: ''
    },
    tab = {},
    onClose
  } = props
  let {
    name,
    size,
    accessTime,
    modifyTime,
    isDirectory,
    path,
    mode,
    type
  } = file
  let {
    host,
    port,
    username
  } = tab
  let iconType = isDirectory ? 'folder' : 'file'
  let ps = {
    visible,
    width: 500,
    title: iconType + ` ${e('attributes')}`,
    footer: null,
    onCancel: onClose
  }
  let fp = resolve(path, name)
  let ffp = type === 'local'
    ? fp
    : `${username}@${host}:${port}:${fp}`
  let perms = mode2permission(mode)
  return (
    <Modal
      {...ps}
    >
      <div className="file-props-wrap relative">
        <Icon type={iconType} className="file-icon" />
        <div className="file-props">
          <p className="bold">{e(iconType)} {e('name')}:</p>
          <p className="pd1b">{name}</p>
          <p className="bold">{e('fullPath')}:</p>
          <p className="pd1b">{ffp}</p>
          <p className="bold">{e('size')}:</p>
          <p className="pd1b">{size}</p>
          <p className="bold">{e('accessTime')}:</p>
          <p className="pd1b">{formatTime(accessTime)}</p>
          <p className="bold">{e('modifyTime')}:</p>
          <p className="pd1b">{formatTime(modifyTime)}</p>
          <p className="bold">{e('mode')}:</p>
          <div className="pd1b">
            {
              perms.map(renderPermission)
            }
          </div>
        </div>
      </div>
    </Modal>
  )

}
