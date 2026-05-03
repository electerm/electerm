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
import uid from '../../common/uid'
import time from '../../common/time'
import { uniq } from 'lodash-es'
import { fixBookmarks } from '../../common/db-fix'
import download from '../../common/download'
import delay from '../../common/wait'
import { action } from 'manate'
import Upload from '../common/upload'

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
  const upload = action(async (file) => {
    const { store } = window
    const filePath = file.filePath
    const txt = await window.fs.readFile(filePath)

    const content = JSON.parse(txt)
    let bookmarkGroups1 = []
    let bookmarks1 = []
    if (Array.isArray(content)) {
      bookmarks1 = content.map(item => {
        if (typeof item === 'string') {
          return null
        } else if (!item.id) {
          item.id = uid()
        }
        return item
      }).filter(Boolean)
      bookmarkGroups1 = [{
        id: uid(),
        title: 'imported_' + time(),
        color: '#0088cc',
        bookmarkGroupIds: [],
        bookmarkIds: bookmarks1.map(b => b.id)
      }]
    } else {
      bookmarkGroups1 = content.bookmarkGroups || []
      bookmarks1 = content.bookmarks || []
    }

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
        const bg1 = store.bookmarkGroups.find(
          b => b.id === bg.id
        )
        bg1.bookmarkIds = uniq(
          [
            ...(bg1.bookmarkIds || []),
            ...(bg.bookmarkIds || [])
          ]
        )
        bg1.bookmarkGroupIds = uniq(
          [
            ...(bg1.bookmarkGroupIds || []),
            ...(bg.bookmarkGroupIds || [])
          ]
        )
      }
    })
    return false
  })
  const beforeUpload = async (file) => {
    const names = [
      'bookmarks',
      'bookmarkGroups'
    ]
    for (const name of names) {
      window[`watch${name}`].stop()
    }
    upload(file)
    await delay(1000)
    for (const name of names) {
      window[`watch${name}`].start()
    }
  }

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
