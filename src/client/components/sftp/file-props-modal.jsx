/**
 * file props
 */

import {Icon, Modal} from 'antd'
import resolve from '../../common/resolve'

export default function FileProps (props) {

  let {
    visible,
    file: {
      name,
      size,
      accessTime,
      modifyTime,
      isDirectory,
      path,
      type
    },
    tab: {
      host,
      port,
      username
    },
    onClose
  } = props
  let ps = {
    visible,
    width: 500,
    title: 'file attributes',
    footer: null,
    onClose
  }
  let fp = resolve(path, name)
  let ffp = type === 'local'
    ? fp
    : `${username}@${host}:${port}:${fp}`
  let iconType = isDirectory ? 'folder' : 'file'
  return (
    <Modal
      {...ps}
    >
      <div className="file-props-wrap relative">
        <Icon type={iconType} className="file-icon" />
        <div className="file-props">
          <p className="bold">file name:</p>
          <p className="pd1b">{name}</p>
          <p className="bold">location:</p>
          <p className="pd1b">{ffp}</p>
          <p className="bold">path:</p>
          <p className="pd1b">{name}</p>
          <p className="bold">size:</p>
          <p className="pd1b">{size}</p>
          <p className="bold">access time:</p>
          <p className="pd1b">{accessTime}</p>
          <p className="bold">modify time:</p>
          <p className="pd1b">{modifyTime}</p>
        </div>
      </div>
    </Modal>
  )

}
