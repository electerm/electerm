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
          checked={props.config.autoSync || false}
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
}
