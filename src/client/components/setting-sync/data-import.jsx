/**
 * data import/export
 */

import {
  Button,
  Upload,
  Switch,
  Tooltip
} from 'antd'
import {
  ImportOutlined,
  ExportOutlined,
  InfoCircleOutlined
} from '@ant-design/icons'
import { auto } from 'manate/react'

const e = window.translate

export default auto(function DataTransport (props) {
  const txt = e('autoSync')
  const {
    store
  } = props
  return (
    <div className='pd2 fix'>
      <div className='fleft'>
        <Button
          icon={<ExportOutlined />}
          className='mg1r'
          onClick={store.handleExportAllData}
        >
          {e('export')}
        </Button>
        <Upload
          beforeUpload={store.importAll}
          fileList={[]}
        >
          <Button
            icon={<ImportOutlined />}
          >
            {e('importFromFile')}
          </Button>
        </Upload>
      </div>
      <div className='fright'>
        <Switch
          checked={store.config.autoSync || false}
          checkedChildren={txt}
          onChange={store.handleAutoSync}
          unCheckedChildren={txt}
          className='mg3l mg1r'
        />
        <Tooltip title={e('autoSyncTip')}>
          <InfoCircleOutlined />
        </Tooltip>
      </div>
    </div>
  )
})
