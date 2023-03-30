/**
 * bookmark import/export
 */

import { Component } from '../common/react-subx'
import {
  DownloadOutlined,
  UploadOutlined,
  EditOutlined
} from '@ant-design/icons'
import { Upload, Button } from 'antd'
import download from '../../common/download'
import time from '../../../app/common/time'
import copy from 'json-deep-copy'
import _ from 'lodash'

const { prefix } = window
const f = prefix('form')
const t = prefix('terminalThemes')
const m = prefix('menu')

export default class BookmarkTransport extends Component {
  beforeUpload = (file) => {
    const { store } = this.props
    const txt = window.pre
      .readFileSync(file.path).toString()
    try {
      const content = JSON.parse(txt)
      const {
        bookmarkGroups: bookmarkGroups1,
        bookmarks: bookmarks1
      } = content
      const bookmarkGroups = copy(store.getBookmarkGroups())
      const bookmarks = copy(store.getBookmarks())
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
          const bg1 = _.find(
            bookmarkGroups,
            b => b.id === bg.id
          )
          const old = copy(bg1.bookmarkIds)
          bg1.bookmarkIds = _.uniq(
            [
              ...bg1.bookmarkIds,
              ...bg.bookmarkIds
            ]
          )
          if (!_.isEqual(bg1.bookmarkIds, old)) {
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
      store.setBookmarks(bookmarks)
      store.batchDbAdd(dbAdd)
      store.batchDbUpdate(updates)
    } catch (e) {
      store.onError(e)
    }
    return false
  }

  down = () => {
    const { store } = this.props
    const bookmarkGroups = store.getBookmarkGroups()
    const bookmarks = store.getBookmarks()
    const txt = JSON.stringify({
      bookmarkGroups: copy(bookmarkGroups),
      bookmarks: copy(bookmarks)
    }, null, 2)
    const stamp = time(undefined, 'YYYY-MM-DD-HH-mm-ss')
    download('bookmarks-' + stamp + '.json', txt)
  }

  toggleEdit = () => {
    this.props.store.bookmarkSelectMode = true
  }

  render () {
    return [
      <Button
        icon={<DownloadOutlined />}
        onClick={this.down}
        className='mg1x iblock'
        title={t('export')}
        key='export'
      />,
      <Upload
        beforeUpload={this.beforeUpload}
        fileList={[]}
        key='Upload'
        className='iblock mg1x'
      >
        <Button
          icon={<UploadOutlined />}
          title={f('importFromFile')}
        />
      </Upload>,
      <Button
        icon={<EditOutlined />}
        onClick={this.toggleEdit}
        className='iblock'
        title={m('edit')}
        key='edit-and-del'
      />
    ]
  }
}
