/**
 * zmodem transfer UI module
 * then run rz to send from your browser or
 * sz <file> to send from the remote peer.
 */

import {memo} from 'react'
import {Progress, Button, Icon, Upload} from 'antd'
import {transferTypeMap} from '../../common/constants'
import './zmodem.styl'

const {prefix} = window
const s = prefix('sftp')
const c = prefix('common')

export default memo((props) => {
  let {zmodemTransfer, cancelZmodem, beforeZmodemUpload} = props
  if (!zmodemTransfer) {
    return null
  }
  let {
    fileInfo,
    type,
    transferedSize,
    percent,
    ending
    //options
  } = zmodemTransfer
  if (ending) {
    return (
      <div className="zmodem-transfer">
        <h2 className="zmodem-transfer-inner">
          {c('cancel')}... <Icon type="loading" />
        </h2>
      </div>
    )
  }
  let btn = null
  if (type === transferTypeMap.upload) {
    btn = (
      <div className="zmodem-transfer">
        <div className="zmodem-transfer-inner">
          <Upload
            multiple
            beforeUpload={beforeZmodemUpload}
            className={fileInfo ? 'hide' : ''}
          >
            <Button>
              {s(type)}
            </Button>
          </Upload>
        </div>
      </div>
    )
  }
  let {
    size,
    name
  } = fileInfo
  return (
    <div className="zmodem-transfer">
      <div className="zmodem-transfer-inner">
        {btn}
        <Progress
          percent={percent}
          size="small"
          status="active"
          format={() => {
            return `%${percent}(${transferedSize}/${size})`
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
