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
import download from '../../common/download'
import time from '../../common/time'
import copy from 'json-deep-copy'
import { find, uniq, isEqual } from 'lodash-es'
import { fixBookmarks } from '../../common/db-fix'

const e = window.translate

export default class BookmarkTransport extends PureComponent {
  beforeUpload = async (file) => {
    const { store } = window
    const txt = await window.fs.readFile(file.path)
    try {
      const content = JSON.parse(txt)
      const {
        bookmarkGroups: bookmarkGroups1,
        bookmarks: bookmarks1
      } = content
      const { props } = this
      const bookmarkGroups = copy(props.bookmarkGroups)
      const bookmarks = copy(props.bookmarks)
      const bmTree = bookmarks.reduce((p, v) => {
        return {
          ...p,
          [v.id]: v
        }
      }, {})
      const bmgTree = bookmarkGroups.reduce((p, v) => {
        return {
          ...p,
          [v.id]: v
        }
      }, {})
      const add = []
      const dbAdd = []
      const updates = []
      bookmarks1.forEach(bg => {
        if (!bmTree[bg.id]) {
          bookmarks.push(bg)
          add.push(bg)
          dbAdd.push({
            db: 'bookmarks',
            obj: bg
          })
        }
      })
      bookmarkGroups1.forEach(bg => {
        if (!bmgTree[bg.id]) {
          bookmarkGroups.push(bg)
          dbAdd.push({
            db: 'bookmarkGroups',
            obj: bg
          })
        } else {
          const bg1 = find(
            bookmarkGroups,
            b => b.id === bg.id
          )
          const old = copy(bg1.bookmarkIds)
          bg1.bookmarkIds = uniq(
            [
              ...bg1.bookmarkIds,
              ...bg.bookmarkIds
            ]
          )
          if (!isEqual(bg1.bookmarkIds, old)) {
            updates.push({
              id: bg1.id,
              db: 'bookmarkGroups',
              update: {
                bookmarkIds: bg1.bookmarkIds
              }
            })
          }
        }
      })
      store.setBookmarkGroups(bookmarkGroups)
      store.setBookmarks(fixBookmarks(bookmarks))
      store.batchDbAdd(dbAdd)
      store.batchDbUpdate(updates)
    } catch (e) {
      store.onError(e)
    }
    return false
  }

  handleDownload = () => {
    const { bookmarkGroups, bookmarks } = this.props
    const txt = JSON.stringify({
      bookmarkGroups: copy(bookmarkGroups),
      bookmarks: copy(bookmarks)
    }, null, 2)
    const stamp = time(undefined, 'YYYY-MM-DD-HH-mm-ss')
    download('bookmarks-' + stamp + '.json', txt)
  }

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
