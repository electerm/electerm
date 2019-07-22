/**
 * bookmark import/export
 */

import { Component } from '../common/react-subx'
import { Upload, Button } from 'antd'
import download from '../../common/download'
import time from '../../common/time'
import copy from 'json-deep-copy'
import _ from 'lodash'

const { prefix } = window
const f = prefix('form')
const t = prefix('terminalThemes')

export default class Btns extends Component {
  render () {
    const { store } = this.props
    const down = () => {
      const {
        bookmarkGroups,
        bookmarks
      } = store
      const txt = JSON.stringify({
        bookmarkGroups,
        bookmarks
      }, null, 2)
      const stamp = time(undefined, 'YYYY-MM-DD-HH-mm-ss')
      download('bookmarks-' + stamp + '.json', txt)
    }

    const beforeUpload = (file) => {
      const txt = window.getGlobal('fs')
        .readFileSync(file.path).toString()
      try {
        const content = JSON.parse(txt)
        const {
          bookmarkGroups: bookmarkGroups1,
          bookmarks: bookmarks1
        } = content
        const bookmarkGroups = copy(store.bookmarkGroups)
        const bookmarks = copy(store.bookmarks)
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
        bookmarks1.forEach(bg => {
          if (!bmTree[bg.id]) {
            bookmarks.push(bg)
            add.push(bg)
          }
        })
        bookmarkGroups1.forEach(bg => {
          if (!bmgTree[bg.id]) {
            bookmarkGroups.push(bg)
          } else {
            const bg1 = _.find(
              bookmarkGroups,
              b => b.id === bg.id
            )
            bg1.bookmarkIds = _.uniq(
              [
                ...bg1.bookmarkIds,
                ...bg.bookmarkIds
              ]
            )
          }
        })
        store.modifier({
          bookmarkGroups,
          bookmarks
        })
      } catch (e) {
        store.onError(e)
      }
      return false
    }

    return [
      <Button
        icon='download'
        onClick={down}
        className='mg1x mg1t'
        title={t('export')}
        key='export'
      />,
      <Upload
        beforeUpload={beforeUpload}
        fileList={[]}
        key='Upload'
      >
        <Button
          icon='upload'
          className='mg1t'
          title={f('importFromFile')}
        />
      </Upload>
    ]
  }
}
