/**
 * zmodem transfer UI module
 * then run rz to send from your browser or
 * sz <file> to send from the remote peer.
 */

import {memo} from 'react'
import {Progress, Button} from 'antd'
import './zmodem.styl'

const {prefix} = window
const s = prefix('sftp')
const c = prefix('common')

export default memo((props) => {
  let {zmodemTransfer, cancelZmodem} = props
  if (!zmodemTransfer) {
    return null
  }
  let {
    fileInfo,
    type,
    trasnferedSize,
    percent
    //options
  } = zmodemTransfer
  let {
    size,
    name
  } = fileInfo
  return (
    <div className="zmodem-transfer">
      <div className="zmodem-transfer-inner">
        <Progress
          percent={percent}
          size="small"
          status="active"
          format={() => {
            return `%${percent}(${trasnferedSize}/${size})`
          }}
        />
        <h2 className="pd2y">
          <span className="iblock">
            {s(type)}: {name}
          </span>
          <Button
            type="danger"
            className="iblock mg2l"
            onClick={cancelZmodem}
          >{c('cancel')}</Button>
        </h2>
      </div>
    </div>
  )
})
