/**
 * history select
 */

import { Component } from '../common/react-subx'
import TreeList from '../setting-panel/tree-list'
import {
  sshConfigItems
} from '../../common/constants'

export default class BookmarkSelect extends Component {
  render () {
    const { store } = this.props
    const {
      listStyle,
      openedCategoryIds
    } = store
    const onClickItem = (item) => {
      if (!store.pinned) {
        store.storeAssign({
          openedSideBar: ''
        })
      }
      store.onSelectBookmark(item.id)
    }
    const base = {
      store,
      bookmarks: [
        ...(store.bookmarks || []),
        ...sshConfigItems
      ],
      type: 'bookmarks',
      onClickItem,
      listStyle,
      staticList: true
    }
    const propsTree = {
      ...base,
      shouldConfirmDel: true,
      bookmarkGroups: store.bookmarkGroupsTotal,
      expandedKeys: openedCategoryIds,
      onExpand: openedCategoryIds => {
        store.storeAssign({
          openedCategoryIds
        })
      }
    }
    return (
      <TreeList
        {...propsTree}
      />
    )
  }
}
