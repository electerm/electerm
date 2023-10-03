/**
 * data import/export
 */

import {
  Button,
  Upload
} from 'antd'
import {
  ImportOutlined,
  ExportOutlined
} from '@ant-design/icons'

const { prefix } = window
const e = prefix('form')
const t = prefix('terminalThemes')

export function DataTransport (props) {
  return (
    <div className='pd2'>
      <Button
        icon={<ExportOutlined />}
        className='mg1r'
        onClick={props.store.handleExportAllData}
      >
        {t('export')}
      </Button>
      <Upload
        beforeUpload={props.store.importAll}
        fileList={[]}
      >
        <Button
          icon={<ImportOutlined />}
        >
          {e('importFromFile')}
        </Button>
      </Upload>

    </div>
  )
}
