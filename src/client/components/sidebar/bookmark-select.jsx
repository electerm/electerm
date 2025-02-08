/**
 * bookmark select
 */

import { auto } from 'manate/react'
import TreeList from '../tree-list/tree-list'

export default auto(function BookmarkSelect (props) {
  const { store, from } = props
  const {
    listStyle,
    openedSideBar,
    leftSidebarWidth,
    expandedKeys,
    bookmarks,
    bookmarksMap
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
    bookmarks: bookmarks || [],
    type: 'bookmarks',
    onClickItem,
    listStyle,
    staticList: true
  }
  const propsTree = {
    ...base,
    shouldConfirmDel: true,
    bookmarksMap,
    bookmarkGroups: store.getBookmarkGroupsTotal(),
    expandedKeys,
    leftSidebarWidth,
    bookmarkGroupTree: store.bookmarkGroupTree
  }
  return (
    <TreeList
      {...propsTree}
    />
  )
})
