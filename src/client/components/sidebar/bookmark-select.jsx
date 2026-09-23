/**
 * bookmark select
 */

import { auto } from 'manate/react'
import TreeList from '../tree-list/tree-list'

export default auto(function BookmarkSelect (props) {
  const { store, from, autoFocus } = props
  const {
    listStyle,
    openedSideBar,
    leftSidePanelWidth,
    expandedKeys,
    bookmarks,
    bookmarksMap,
    initLoadingData
  } = store
  if (from === 'sidebar' && openedSideBar !== 'bookmarks') {
    return null
  }
  const onClickItem = (item) => {
    // A pinned (docked) panel stays open; anything else — including mobile,
    // where pinning is not a reachable mode — dismisses on selection.
    if (!(store.pinned && !store.isMobile)) {
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
    leftSidePanelWidth,
    bookmarkGroupTree: store.bookmarkGroupTree,
    autoFocus,
    initLoadingData
  }
  return (
    <TreeList
      {...propsTree}
    />
  )
})
