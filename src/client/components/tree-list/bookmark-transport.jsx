/**
 * bookmark import/export
 */

import { PureComponent } from 'react'
import { Upload as UploadIcon, Import, Edit } from 'lucide-react'
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
        icon={<Edit />}
        onClick={this.handleToggleEdit}
        title={e('edit')}
        key='edit-and-del'
      />
    )
  }

  renderExport () {
    return (
      <Button
        icon={<UploadIcon />}
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
          icon={<Import />}
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
    return (
      <Space.Compact>
        {edit}
        {this.renderExport()}
        {this.renderImport()}
      </Space.Compact>
    )
  }
}
