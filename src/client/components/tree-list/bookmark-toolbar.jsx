import {
  BookOutlined,
  FolderOutlined,
  ImportOutlined,
  ExportOutlined,
  CodeOutlined,
  MoreOutlined,
  PlusOutlined,
  EditOutlined
} from '@ant-design/icons'
import { Button, Space, Dropdown, Flex } from 'antd'
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

    <div className='pd1b pd1r bookmark-toolbar'>
      <Flex justify='space-between' align='center' gap={6}>
        <Button
          type='primary'
          icon={<PlusOutlined />}
          onClick={onNewBookmark}
          className='new-bookmark-btn'
        >
          {titleNew}
        </Button>
        <Space size={4}>
          <Button
            icon={<FolderOutlined />}
            onClick={onNewBookmarkGroup}
            title={titleEdit}
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
            className='upload-bookmark-icon hide'
          >
            <span />
          </Upload>
          <Dropdown {...ddProps}>
            <Button icon={<MoreOutlined />} />
          </Dropdown>
        </Space>
      </Flex>
    </div>
  )
}
