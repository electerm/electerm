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
      let {
        bookmarkGroups,
        bookmarks
      } = store
      let txt = JSON.stringify({
        bookmarkGroups,
        bookmarks
      }, null, 2)
      let stamp = time(undefined, 'YYYY-MM-DD-HH-mm-ss')
      download('bookmarks-' + stamp + '.json', txt)
    }

    const beforeUpload = (file) => {
      let txt = window.getGlobal('fs')
        .readFileSync(file.path).toString()
      try {
        let content = JSON.parse(txt)
        let {
          bookmarkGroups: bookmarkGroups1,
          bookmarks: bookmarks1
        } = content
        let bookmarkGroups = copy(store.bookmarkGroups)
        let bookmarks = copy(store.bookmarks)
        let bmTree = bookmarks.reduce((p, v) => {
          return {
            ...p,
            [v.id]: v
          }
        }, {})
        let bmgTree = bookmarkGroups.reduce((p, v) => {
          return {
            ...p,
            [v.id]: v
          }
        }, {})
        let add = []
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
            let bg1 = _.find(
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
