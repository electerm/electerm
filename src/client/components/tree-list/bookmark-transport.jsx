/**
 * bookmark import/export
 */

import { PureComponent } from 'react'
import {
  ExportOutlined,
  ImportOutlined
} from '@ant-design/icons'
import { Button, Space } from 'antd'
import Upload from '../common/upload'
import { beforeBookmarkUpload } from './bookmark-upload'

const e = window.translate

export default class BookmarkTransport extends PureComponent {
  beforeUpload = beforeBookmarkUpload

  handleDownload = () => {}

  renderExport () {
    return (
      <Button
        icon={<ExportOutlined />}
        onClick={this.handleDownload}
        title={e('export')}
        className='download-bookmark-icon'
        key='export'
      />
    )
  }

  renderImport () {
    return (
      <Upload
        beforeUpload={this.beforeUpload}
        fileList={[]}
        className='upload-bookmark-icon'
        key='Upload'
      >
        <Button
          icon={<ImportOutlined />}
          title={e('importFromFile')}
        />
      </Upload>
    )
  }

  render () {
    return (
      <Space.Compact>
        {this.renderExport()}
        {this.renderImport()}
      </Space.Compact>
    )
  }
}
