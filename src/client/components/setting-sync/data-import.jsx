/**
 * data import/export
 */

import {
  Button,
  Switch,
  Tooltip
} from 'antd'
import { Import, Upload as UploadIcon, Info } from 'lucide-react'
import Upload from '../common/upload'

const e = window.translate

export default function DataTransport (props) {
  const txt = e('autoSync')
  const {
    store
  } = window
  return (
    <div className='pd2 fix'>
      <div className='fleft'>
        <Button
          icon={<UploadIcon />}
          className='mg1r'
          onClick={store.handleExportAllData}
        >
          {e('export')}
        </Button>
        <Upload
          beforeUpload={store.importAll}
          fileList={[]}
          className='inline'
        >
          <Button
            icon={<Import />}
          >
            {e('importFromFile')}
          </Button>
        </Upload>
      </div>
      <div className='fright'>
        <Switch
          checked={props.config.autoSync || false}
          checkedChildren={txt}
          onChange={store.handleAutoSync}
          unCheckedChildren={txt}
          className='mg3l mg1r'
        />
        <Tooltip title={e('autoSyncTip')}>
          <Info />
        </Tooltip>
      </div>
    </div>
  )
}
