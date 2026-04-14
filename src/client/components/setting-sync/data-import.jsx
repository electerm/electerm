/**
 * data import/export
 */

import {
  Button,
  Switch,
  Select,
  Space
} from 'antd'
import {
  ImportOutlined,
  ExportOutlined
} from '@ant-design/icons'
import Upload from '../common/upload'
import HelpIcon from '../common/help-icon'

const e = window.translate

const intervalOptions = [
  { value: 0, label: e('autoSyncOnChange') },
  { value: 5, label: '5 ' + e('minutes') },
  { value: 10, label: '10 ' + e('minutes') },
  { value: 15, label: '15 ' + e('minutes') },
  { value: 30, label: '30 ' + e('minutes') },
  { value: 60, label: '1 ' + e('hours') },
  { value: 120, label: '2 ' + e('hours') },
  { value: 360, label: '6 ' + e('hours') },
  { value: 720, label: '12 ' + e('hours') },
  { value: 1440, label: '24 ' + e('hours') }
]

const directionOptions = [
  { value: 'upload', label: e('uploadSettings') },
  { value: 'download', label: e('downloadSettings') }
]

export default function DataTransport (props) {
  const txt = e('autoSync')
  const {
    store
  } = window

  const syncSetting = props.config.syncSetting || {}
  const autoSyncEnabled = syncSetting.autoSync || false
  const autoSyncInterval = syncSetting.autoSyncInterval || 0
  const autoSyncDirection = syncSetting.autoSyncDirection || 'upload'

  function handleAutoSync (checked) {
    store.updateSyncSetting({
      autoSync: checked
    })
  }

  function handleIntervalChange (value) {
    store.updateSyncSetting({
      autoSyncInterval: value
    })
  }

  function handleDirectionChange (value) {
    store.updateSyncSetting({
      autoSyncDirection: value
    })
  }

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
          className='inline'
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
          checked={autoSyncEnabled}
          checkedChildren={txt}
          onChange={handleAutoSync}
          unCheckedChildren={txt}
          className='mg3l mg1r'
        />
        {autoSyncEnabled && (
          <Space className='mg1l' size='small'>
            <Select
              value={autoSyncInterval}
              onChange={handleIntervalChange}
              options={intervalOptions}
              style={{ width: 120 }}
              popupMatchSelectWidth={false}
            />
            <Select
              value={autoSyncDirection}
              onChange={handleDirectionChange}
              options={directionOptions}
              style={{ width: 100 }}
              popupMatchSelectWidth={false}
            />
          </Space>
        )}
        <HelpIcon
          link='https://github.com/electerm/electerm/wiki/Auto-data-Sync'
        />
      </div>
    </div>
  )
}
