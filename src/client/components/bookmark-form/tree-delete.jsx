import StartSessionSelect from '../setting-panel/start-session-select'
import {
  Tree,
  Button
} from 'antd'
import { defaultBookmarkGroupId, settingMap } from '../../common/constants'
import deepCopy from 'json-deep-copy'

const e = window.translate

export default class BookmarkTreeDelete extends StartSessionSelect {
  onExpand = (expandedKeys) => {
    window.store.expandedKeys = deepCopy(expandedKeys)
  }

  onCheck = (checkedKeys) => {
    window.store.checkedKeys = deepCopy(checkedKeys)
  }

  handleDel = () => {
    const { store } = window
    const {
      checkedKeys
    } = this.props
    const arr = checkedKeys.filter(d => d !== defaultBookmarkGroupId)
    store.delItems(arr, settingMap.bookmarks)
    store.delItems(arr, settingMap.bookmarkGroups)
    store.checkedKeys = []
  }

  handleCancel = () => {
    const { store } = window
    store.bookmarkSelectMode = false
    store.checkedKeys = []
  }

  render () {
    const { expandedKeys, checkedKeys } = this.props
    const rProps = {
      checkable: true,
      autoExpandParent: true,
      onCheck: this.onCheck,
      expandedKeys,
      checkedKeys,
      onExpand: this.onExpand,
      treeData: this.buildData()
    }
    const len = checkedKeys.length
    return (
      <div>
        <div className='pd1'>
          <Button
            type='primary'
            disabled={!len}
            onClick={this.handleDel}
          >
            {e('delSelected')} ({len})
          </Button>
          <Button
            onClick={this.handleCancel}
          >
            {e('cancel')}
          </Button>
        </div>
        <Tree {...rProps} />
      </div>
    )
  }
}
