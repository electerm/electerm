/**
 * history select
 */

import {memo} from 'react'
import ItemList from '../setting-panel/list'
import TreeList from '../setting-panel/tree-list'
import copy from 'json-deep-copy'

const {getGlobal} = window
const sshConfigItems = copy(getGlobal('sshConfigItems'))

export default memo((props) => {
  let {
    bookmarkGroups = [],
    listStyle,
    openedCategoryIds
  } = props
  const onClickItem = (item) => {
    props.modifier({
      openedSideBar: ''
    })
    props.onSelectBookmark(item.id)
  }
  let props0 = {
    bookmarks: [
      ...(props.bookmarks || []),
      ...sshConfigItems
    ],
    type: 'bookmarks',
    onClickItem,
    listStyle
  }
  let bookmarkGroupsTotal = sshConfigItems.length
    ? [
      ...bookmarkGroups,
      {
        title: 'ssh-config',
        id: 'ssh-config',
        bookmarkIds: sshConfigItems.map(d => d.id)
      }
    ]
    : bookmarkGroups
  return bookmarkGroups.filter(d => d.level !== 2).length > 1
    ? (
      <TreeList
        {...props}
        {...props0}
        shouldComfirmDel
        staticList
        bookmarkGroups={bookmarkGroupsTotal}
        onClickItem={onClickItem}
        expandedKeys={openedCategoryIds}
        onExpand={openedCategoryIds => {
          props.modifyLs({
            openedCategoryIds
          })
        }}
      />
    )
    : (
      <ItemList
        {...props0}
        list={props0.bookmarks || []}
        onClickItem={item => props.onSelectBookmark(item.id)}
      />
    )

})
