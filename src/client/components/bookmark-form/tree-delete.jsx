import StartSessionSelect from '../setting-panel/start-session-select'
import {
  Tree,
  Button
} from 'antd'
import { defaultBookmarkGroupId, settingMap } from '../../common/constants'

const { prefix } = window
const m = prefix('common')

export default class BookmarkTreeDelete extends StartSessionSelect {
  onExpand = (expandedKeys) => {
    window.store.setState(
      'expandedKeys',
      expandedKeys
    )
  }

  onCheck = (checkedKeys) => {
    window.store.setState(
      'checkedKeys',
      checkedKeys
    )
  }

  handleDel = () => {
    const { store } = window
    const {
      checkedKeys,
      bookmarks,
      bookmarkGroups
    } = store
    store.setBookmarks(
      bookmarks.filter(f => {
        return !checkedKeys.includes(f.id)
      })
    )
    store.setBookmarkGroups(
      bookmarkGroups.filter(f => {
        return f.id === defaultBookmarkGroupId || !checkedKeys.includes(f.id)
      })
    )
    const arr = checkedKeys.filter(d => d !== defaultBookmarkGroupId)
    store.delItems(arr, settingMap.bookmarks)
    store.delItems(arr, settingMap.bookmarkGroups)
    store.setState('checkedKeys', [])
  }

  handleCancel = () => {
    const { store } = window
    store.bookmarkSelectMode = false
    store.setState('checkedKeys', [])
  }

  render () {
    const { store } = this.props
    const rProps = {
      checkable: true,
      autoExpandParent: true,
      onCheck: this.onCheck,
      expandedKeys: store.expandedKeys,
      checkedKeys: store.checkedKeys,
      onExpand: this.onExpand,
      treeData: this.buildData()
    }
    const len = store.checkedKeys.length
    return (
      <div>
        <div className='pd1'>
          <Button
            type='primary'
            disabled={!len}
            onClick={this.handleDel}
          >
            {m('delSelected')} ({len})
          </Button>
          <Button
            onClick={this.handleCancel}
          >
            {m('cancel')}
          </Button>
        </div>
        <Tree {...rProps} />
      </div>
    )
  }
}
