/**
 * bookmark import/export
 */

import { PureComponent } from 'react'
import {
  DownloadOutlined,
  UploadOutlined,
  EditOutlined
} from '@ant-design/icons'
import { Upload, Button } from 'antd'

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

  render () {
    return [
      this.renderEdit(),
      <Button
        icon={<DownloadOutlined />}
        onClick={this.handleDownload}
        title={e('export')}
        className='download-bookmark-icon'
        key='export'
      />,
      <Upload
        beforeUpload={this.beforeUpload}
        fileList={[]}
        className='upload-bookmark-icon'
        key='Upload'
      >
        <Button
          icon={<UploadOutlined />}
          title={e('importFromFile')}
        />
      </Upload>
    ]
  }
}
