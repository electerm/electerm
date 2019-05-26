/**
 * zmodem transfer UI module
 * then run rz to send from your browser or
 * sz <file> to send from the remote peer.
 */

import { memo } from 'react'
import { Progress, Button, Upload } from 'antd'
import { transferTypeMap } from '../../common/constants'
import './zmodem.styl'

const { prefix } = window
const s = prefix('sftp')
const c = prefix('common')

export default memo((props) => {
  let { zmodemTransfer, cancelZmodem, beforeZmodemUpload } = props
  if (!zmodemTransfer) {
    return null
  }
  let {
    fileInfo,
    type,
    transferedSize,
    percent
    // options
  } = zmodemTransfer
  let btn = null
  let progress = null
  let cancelBtn = (
    <Button
      type='danger'
      className='iblock mg2l'
      onClick={cancelZmodem}
    >{c('cancel')}</Button>
  )
  if (type === transferTypeMap.upload) {
    btn = (
      <div className={fileInfo ? 'hide' : 'mg2b'}>
        <div className='iblock'>
          <Upload
            showUploadList={false}
            beforeUpload={beforeZmodemUpload}
            className={fileInfo ? 'hide' : 'iblock'}
          >
            <Button>
              {s(type)}
            </Button>
          </Upload>
        </div>
        {cancelBtn}
      </div>
    )
  }
  if (fileInfo) {
    let {
      size,
      name
    } = fileInfo
    progress = (
      <div className='pd1b'>
        <Progress
          percent={percent}
          size='small'
          status='active'
          format={() => {
            return `%${percent}(${transferedSize}/${size})`
          }}
        />
        <h2 className='pd2y'>
          <span className='iblock'>
            {s(type)}: {name}
          </span>
          {cancelBtn}
        </h2>
      </div>
    )
  }
  return (
    <div className='zmodem-transfer'>
      <div className='zmodem-transfer-inner'>
        {btn}
        {progress}
      </div>
    </div>
  )
})
