/**
 * zmodem transfer UI module
 * then run rz to send from your browser or
 * sz <file> to send from the remote peer.
 */

import { memo } from 'react'
import { Progress, Button, Upload } from 'antd'
import { transferTypeMap } from '../../common/constants'
import Link from '../common/external-link'
import './zmodem.styl'

const { prefix } = window
const s = prefix('sftp')
const c = prefix('common')

export default memo((props) => {
  const { zmodemTransfer, cancelZmodem, beforeZmodemUpload } = props
  if (!zmodemTransfer) {
    return null
  }
  const {
    fileInfo,
    type,
    transferedSize,
    percent
    // options
  } = zmodemTransfer
  let btn = null
  let progress = null
  const cancelBtn = (
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
        <h4 className='pd2t pd2x'>Only support upload small files(less than 8M) due to known issue:</h4>
        <h4 className='pd2b pd2x'>
          <Link to='https://github.com/FGasper/zmodemjs/issues/11'>https://github.com/FGasper/zmodemjs/issues/11</Link>
        </h4>
      </div>
    )
  }
  if (fileInfo) {
    const {
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
