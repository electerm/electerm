import { memo } from 'react'
import TreeExpander from './tree-expander'
import TreeListItem from './tree-list-item'
import TreeItemOp from './tree-item-op'
import {
  isTreeIndentCapped,
  treeGroupPaddingPx,
  treeIndentPx
} from './tree-list-layout'
import createName from '../../common/create-title'

// memoized: VirtualTreeList re-renders every scroll frame and re-invokes
// renderItem for the whole visible window; without memo each row (including
// the antd Popconfirm/Tooltip in TreeItemOp) re-renders per frame.
// `expanded` is a boolean (not the expandedKeys array) because the array is
// mutated in place, so identity-based memo comparison would miss changes.
function TreeListRow (props) {
  const {
    row,
    keyword,
    expanded,
    activeItemId,
    selectedRowKey,
    staticList,
    leftSidePanelWidth,
    handleExpand,
    handleUnExpand,
    del,
    openAll,
    openMoveModal,
    editItem,
    addSubCat,
    onSelect,
    duplicateItem,
    onDragStart,
    onDrop,
    onDragEnter,
    onDragLeave,
    onDragOver,
    isHidden
  } = props
  const { item, isGroup, parentId, depth } = row
  const groupHasChildren = Boolean(
    item?.bookmarkIds?.length ||
    item?.bookmarkGroupIds?.length
  )
  // `path` is the ancestor chain built by buildVisibleTreeRows; joined here so
  // TreeListItem's memo comparison stays a string comparison (the row objects
  // are rebuilt on every render, an array prop would never compare equal).
  // A single ancestor carries no disambiguation ("Default / host" is noise), so
  // the prefix only starts once an item sits two or more groups deep.
  const itemPath = (row.path || []).length > 1
    ? row.path.join(' / ')
    : ''
  const itemProps = {
    item,
    isGroup,
    parentId,
    itemLabel: isGroup ? (item?.title || '') : createName(item),
    itemColor: item?.color,
    itemDescription: item?.description,
    itemLevel: item?.level,
    itemPath,
    indentCapped: isTreeIndentCapped(depth),
    leftSidePanelWidth,
    staticList,
    selectedItemId: activeItemId,
    rowSelected: selectedRowKey === row.key,
    del,
    openAll,
    openMoveModal,
    editItem,
    addSubCat,
    onSelect,
    duplicateItem,
    onDragStart,
    onDrop,
    onDragEnter,
    onDragLeave,
    onDragOver,
    keyword
  }

  if (!isGroup) {
    return (
      <div
        className={`tree-list-row${isHidden ? ' is-hidden' : ''}`}
        style={{ paddingLeft: treeIndentPx(depth) }}
      >
        <TreeListItem {...itemProps} />
        <TreeItemOp
          item={item}
          isGroup={isGroup}
          staticList={staticList}
          del={del}
          openAll={openAll}
          openMoveModal={openMoveModal}
          editItem={editItem}
          addSubCat={addSubCat}
          duplicateItem={duplicateItem}
        />
      </div>
    )
  }

  // the group row's own left padding comes from .tree-list-row-group (the
  // expander column), so it is one step less than its content offset
  const groupPadding = treeGroupPaddingPx(depth)
  return (
    <div
      className={`tree-list-row${isHidden ? ' is-hidden' : ''}`}
      style={{ paddingLeft: groupPadding }}
    >
      <div className='tree-list-row-group'>
        <TreeExpander
          level={parentId}
          group={item}
          hasChildren={groupHasChildren}
          shouldOpen={expanded}
          onExpand={handleExpand}
          onUnExpand={handleUnExpand}
        />
        <TreeListItem {...itemProps} />
        <TreeItemOp
          item={item}
          isGroup={isGroup}
          staticList={staticList}
          del={del}
          openAll={openAll}
          openMoveModal={openMoveModal}
          editItem={editItem}
          addSubCat={addSubCat}
          duplicateItem={duplicateItem}
        />
      </div>
    </div>
  )
}

export default memo(TreeListRow)
