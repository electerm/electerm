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
    const { store, from } = this.props
    const {
      listStyle,
      openedSideBar,
      openedCategoryIds
    } = store
    if (from === 'sidebar' && openedSideBar !== 'bookmarks') {
      return null
    }
    const onClickItem = (item) => {
      if (!store.pinned) {
        store.setOpenedSideBar('')
      }
      store.onSelectBookmark(item.id)
    }
    const base = {
      store,
      bookmarks: [
        ...(store.getBookmarks() || []),
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
      bookmarkGroups: store.getBookmarkGroupsTotal(),
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
