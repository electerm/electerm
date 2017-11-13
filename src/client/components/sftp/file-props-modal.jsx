/**
 * file props
 */

import {Icon, Modal} from 'antd'
import resolve from '../../common/resolve'
import moment from 'moment'

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
    onClose
  }
  let fp = resolve(path, name)
  let ffp = type === 'local'
    ? fp
    : `${username}@${host}:${port}:${fp}`

  return (
    <Modal
      {...ps}
    >
      <div className="file-props-wrap relative">
        <Icon type={iconType} className="file-icon" />
        <div className="file-props">
          <p className="bold">{iconType} name:</p>
          <p className="pd1b">{name}</p>
          <p className="bold">location:</p>
          <p className="pd1b">{ffp}</p>
          <p className="bold">path:</p>
          <p className="pd1b">{name}</p>
          <p className="bold">size:</p>
          <p className="pd1b">{size}</p>
          <p className="bold">access time:</p>
          <p className="pd1b">{formatTime(accessTime)}</p>
          <p className="bold">modify time:</p>
          <p className="pd1b">{formatTime(modifyTime)}</p>
        </div>
      </div>
    </Modal>
  )

}
