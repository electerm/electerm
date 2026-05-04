import {
  BookOutlined,
  FolderOutlined,
  ImportOutlined,
  ExportOutlined,
  CodeOutlined,
  MenuOutlined,
  EditOutlined
} from '@ant-design/icons'
import { Button, Space, Dropdown } from 'antd'
import copy from 'json-deep-copy'
import time from '../../common/time'
import download from '../../common/download'
import Upload from '../common/upload'
import { beforeBookmarkUpload } from './bookmark-upload'

const e = window.translate

export default function BookmarkToolbar (props) {
  const {
    onNewBookmark,
    onNewBookmarkGroup,
    onExport,
    onSshConfigs,
    bookmarkGroups,
    bookmarks
  } = props
  const beforeUpload = beforeBookmarkUpload

  const handleDownload = () => {
    const txt = JSON.stringify({
      bookmarkGroups: copy(bookmarkGroups || []),
      bookmarks: copy(bookmarks || [])
    }, null, 2)
    const stamp = time(undefined, 'YYYY-MM-DD-HH-mm-ss')
    download('bookmarks-' + stamp + '.json', txt)
  }
  const handleToggleEdit = () => {
    window.store.bookmarkSelectMode = true
  }
  const titleNew = `${e('new')} ${e('bookmarks')}`
  const titleEdit = `${e('new')} ${e('bookmarkCategory')}`
  const items = [
    {
      label: titleNew,
      onClick: onNewBookmark,
      icon: <BookOutlined />
    },
    {
      label: titleEdit,
      onClick: onNewBookmarkGroup,
      icon: <FolderOutlined />
    },
    {
      label: e('edit'),
      onClick: handleToggleEdit,
      icon: <EditOutlined />
    },
    {
      label: e('import'),
      onClick: () => {
        const fileInput = document.querySelector('.upload-bookmark-icon')
        if (fileInput) {
          fileInput.click()
        }
      },
      icon: <ImportOutlined />
    },
    {
      label: e('export'),
      onClick: onExport,
      icon: <ExportOutlined />
    },
    {
      label: e('loadSshConfigs'),
      onClick: onSshConfigs,
      icon: <CodeOutlined />
    }
  ]

  const ddProps = {
    menu: {
      items
    }
  }

  return (

    <div className='pd1b pd1r'>
      <div className='fix'>
        <div className='fleft'>
          <Space.Compact>
            <Button onClick={onNewBookmark}>
              <BookOutlined className='with-plus' />
            </Button>
            <Button onClick={onNewBookmarkGroup}>
              <FolderOutlined className='with-plus' />
            </Button>
            <Button
              icon={<EditOutlined />}
              onClick={handleToggleEdit}
              title={e('edit')}
            />
            <Button
              icon={<ExportOutlined />}
              onClick={handleDownload}
              title={e('export')}
              className='download-bookmark-icon'
            />
            <Upload
              beforeUpload={beforeUpload}
              fileList={[]}
              className='upload-bookmark-icon'
            >
              <Button
                icon={<ImportOutlined />}
                title={e('importFromFile')}
              />
            </Upload>
            <Button onClick={onSshConfigs}>
              <CodeOutlined />
            </Button>
          </Space.Compact>
        </div>
        <div className='fright'>
          <Dropdown {...ddProps}>
            <MenuOutlined />
          </Dropdown>
        </div>
      </div>
    </div>
  )
}
