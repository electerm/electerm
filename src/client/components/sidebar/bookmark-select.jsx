/**
 * history select
 */

import { Component } from '../common/react-subx'
import ItemList from '../setting-panel/list'
import TreeList from '../setting-panel/tree-list'
import copy from 'json-deep-copy'

const { getGlobal } = window
const sshConfigItems = copy(getGlobal('sshConfigItems'))

export default class BookmarkSelect extends Component {
  render () {
    const { store } = this.props
    const {
      bookmarkGroups = [],
      listStyle,
      openedCategoryIds
    } = store
    const onClickItem = (item) => {
      store.modifier({
        openedSideBar: ''
      })
      store.onSelectBookmark(item.id)
    }
    const props0 = {
      bookmarks: [
        ...(store.bookmarks || []),
        ...sshConfigItems
      ],
      type: 'bookmarks',
      onClickItem,
      listStyle
    }
    return bookmarkGroups.filter(d => d.level !== 2).length > 1
      ? (
        <TreeList
          store={store}
          {...props0}
          shouldComfirmDel
          staticList
          bookmarkGroups={store.bookmarkGroupsTotal}
          onClickItem={onClickItem}
          expandedKeys={openedCategoryIds}
          onExpand={openedCategoryIds => {
            store.setState({
              openedCategoryIds
            })
          }}
        />
      )
      : (
        <ItemList
          {...props0}
          list={props0.bookmarks || []}
          onClickItem={item => store.onSelectBookmark(item.id)}
        />
      )
  }
}
