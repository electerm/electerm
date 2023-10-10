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
import { Component } from '../common/react-subx'

const { prefix } = window
const e = prefix('form')
const t = prefix('terminalThemes')
const s = prefix('settingSync')

export class DataTransport extends Component {
  render () {
    const txt = s('autoSync')
    const {
      store
    } = this.props
    return (
      <div className='pd2 fix'>
        <div className='fleft'>
          <Button
            icon={<ExportOutlined />}
            className='mg1r'
            onClick={store.handleExportAllData}
          >
            {t('export')}
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
          <Tooltip title={s('autoSyncTip')}>
            <InfoCircleOutlined />
          </Tooltip>
        </div>
      </div>
    )
  }
}
