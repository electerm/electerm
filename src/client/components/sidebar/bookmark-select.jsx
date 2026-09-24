/**
 * bookmark select
 */

import { useState } from 'react'
import { auto } from 'manate/react'
import TreeList from '../tree-list/tree-list'

export default auto(function BookmarkSelect (props) {
  const { store, from, autoFocus } = props
  const [activeItemId, setActiveItemId] = useState('')
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
  const openBookmark = (item) => {
    // A pinned (docked) panel stays open; anything else — including mobile,
    // where pinning is not a reachable mode — dismisses on selection.
    if (!(store.pinned && !store.isMobile)) {
      store.setOpenedSideBar('')
    }
    store.onSelectBookmark(item.id)
  }
  // doubleClickToOpenBookmark: a single click only marks the row, the session
  // opens on a double click. Touch devices have no double click, so the setting
  // is ignored there. This is the sidebar list only — the settings bookmarks tab
  // keeps selecting for editing on a single click.
  const openOnDoubleClick = !!store.config.doubleClickToOpenBookmark &&
    !store.isTouchDevice
  const base = {
    bookmarks: bookmarks || [],
    type: 'bookmarks',
    activeItemId: openOnDoubleClick ? activeItemId : undefined,
    onClickItem: openOnDoubleClick
      ? item => setActiveItemId(item.id)
      : openBookmark,
    onDoubleClickItem: openOnDoubleClick ? openBookmark : undefined,
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
