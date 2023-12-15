/**
 * history select
 */

import { Component } from '../common/react-subx'
import TreeList from '../setting-panel/tree-list'

export default class BookmarkSelect extends Component {
  render () {
    const { store, from } = this.props
    const {
      listStyle,
      openedSideBar,
      expandedKeys
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
      bookmarks: store.bookmarks || [],
      type: 'bookmarks',
      onClickItem,
      listStyle,
      staticList: true
    }
    if (!store.config.hideSshConfig) {
      base.bookmarks.push(...store.sshConfigItems)
    }
    const propsTree = {
      ...base,
      shouldConfirmDel: true,
      bookmarkGroups: store.getBookmarkGroupsTotal(),
      expandedKeys
    }
    return (
      <TreeList
        {...propsTree}
      />
    )
  }
}
