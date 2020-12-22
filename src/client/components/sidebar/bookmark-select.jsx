/**
 * history select
 */

import { Component } from '../common/react-subx'
import ItemList from '../setting-panel/list'
import TreeList from '../setting-panel/tree-list'
import {
  sshConfigItems
} from '../../common/constants'

export default class BookmarkSelect extends Component {
  render () {
    const { store } = this.props
    const {
      bookmarkGroups = [],
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
      shouldComfirmDel: true,
      bookmarkGroups: store.bookmarkGroupsTotal,
      expandedKeys: openedCategoryIds,
      onExpand: openedCategoryIds => {
        store.storeAssign({
          openedCategoryIds
        })
      }
    }
    const propsList = {
      ...base,
      bookmarks: undefined,
      list: base.bookmarks || []
    }
    return bookmarkGroups.filter(d => d.level !== 2).length > 1
      ? (
        <TreeList
          {...propsTree}
        />
      )
      : (
        <ItemList
          {...propsList}
        />
      )
  }
}
