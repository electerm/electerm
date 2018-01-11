/**
 * file props
 */

import {Icon, Modal} from 'antd'
import resolve from '../../common/resolve'
import {mode2permission} from '../../common/mode2permission'
import moment from 'moment'
import renderPermission from './permission-render'

const formatTime = time => {
  return moment(time).format()
}

export default function FileProps (props) {

  let {
    visible,
    file,
    tab,
    onClose
  } = props
  if (!visible) {
    return null
  }
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
    title: iconType + ' attributes',
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
          <p className="bold">{iconType} name:</p>
          <p className="pd1b">{name}</p>
          <p className="bold">full path:</p>
          <p className="pd1b">{ffp}</p>
          <p className="bold">size:</p>
          <p className="pd1b">{size}</p>
          <p className="bold">access time:</p>
          <p className="pd1b">{formatTime(accessTime)}</p>
          <p className="bold">modify time:</p>
          <p className="pd1b">{formatTime(modifyTime)}</p>
          <p className="bold">mode:</p>
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
