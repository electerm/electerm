import {
  BookOutlined,
  FolderOutlined,
  UploadOutlined,
  DownloadOutlined,
  CodeOutlined,
  MenuOutlined,
  EditOutlined
} from '@ant-design/icons'
import { Button, Space, Dropdown, Upload } from 'antd'
import copy from 'json-deep-copy'
import time from '../../common/time'
import { find, uniq } from 'lodash-es'
import { fixBookmarks } from '../../common/db-fix'
import download from '../../common/download'
import { action } from 'manate'

const e = window.translate

export default function BookmarkToolbar (props) {
  const {
    onNewBookmark,
    onNewBookmarkGroup,
    onImport,
    onExport,
    onSshConfigs,
    bookmarkGroups,
    bookmarks
  } = props
  const beforeUpload = action(async (file) => {
    const { store } = window
    const txt = await window.fs.readFile(file.path)
    try {
      const content = JSON.parse(txt)
      const {
        bookmarkGroups: bookmarkGroups1,
        bookmarks: bookmarks1
      } = content
      const bookmarkGroups0 = copy(bookmarkGroups)
      const bookmarks0 = copy(bookmarks)

      // Using Map instead of reduce
      const bmTree = new Map(
        bookmarks0.map(bookmark => [bookmark.id, bookmark])
      )
      const bmgTree = new Map(
        bookmarkGroups0.map(group => [group.id, group])
      )

      const fixed = fixBookmarks(bookmarks1)

      fixed.forEach(bg => {
        if (!bmTree.has(bg.id)) {
          store.bookmarks.push(bg)
        }
      })

      bookmarkGroups1.forEach(bg => {
        if (!bmgTree.has(bg.id)) {
          store.bookmarkGroups.push(bg)
        } else {
          const bg1 = find(
            store.bookmarkGroups,
            b => b.id === bg.id
          )
          bg1.bookmarkIds = uniq(
            [
              ...bg1.bookmarkIds,
              ...bg.bookmarkIds
            ]
          )
        }
      })
    } catch (e) {
      store.onError(e)
    }
    return false
  })

  const handleDownload = () => {
    const txt = JSON.stringify({
      bookmarkGroups: copy(bookmarkGroups),
      bookmarks: copy(bookmarks)
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
      onClick: onImport,
      icon: <UploadOutlined />
    },
    {
      label: e('export'),
      onClick: onExport,
      icon: <DownloadOutlined />
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
              icon={<DownloadOutlined />}
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
                icon={<UploadOutlined />}
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
