/**
 * bookmark import/export
 */

import { PureComponent } from 'react'
import {
  ExportOutlined,
  ImportOutlined,
  EditOutlined
} from '@ant-design/icons'
import { Button, Space } from 'antd'
import Upload from '../common/upload'

const e = window.translate

export default class BookmarkTransport extends PureComponent {
  beforeUpload = async (file) => {}

  handleDownload = () => {}

  handleToggleEdit = () => {
    window.store.bookmarkSelectMode = true
  }

  renderEdit () {
    return (
      <Button
        icon={<EditOutlined />}
        onClick={this.handleToggleEdit}
        title={e('edit')}
        key='edit-and-del'
      />
    )
  }

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
    const edit = this.renderEdit()
    if (edit === null) {
      return (
        <Space.Compact>
          {this.renderExport()}
          {this.renderImport()}
        </Space.Compact>
      )
    }
    return [
      edit,
      this.renderExport(),
      this.renderImport()
    ]
  }
}
