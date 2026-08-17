import { memo } from 'react'
import TreeExpander from './tree-expander'
import TreeListItem from './tree-list-item'
import TreeItemOp from './tree-item-op'
import { treeLevelIndent } from './tree-list-layout'
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
    searchSelectedRowKey,
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
  const itemProps = {
    item,
    isGroup,
    parentId,
    itemLabel: isGroup ? (item?.title || '') : createName(item),
    itemColor: item?.color,
    itemDescription: item?.description,
    itemLevel: item?.level,
    leftSidePanelWidth,
    staticList,
    selectedItemId: activeItemId,
    searchSelected: searchSelectedRowKey === row.key,
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
        style={{ paddingLeft: depth * treeLevelIndent }}
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

  return (
    <div
      className={`tree-list-row${isHidden ? ' is-hidden' : ''}`}
      style={{ paddingLeft: Math.max(0, (depth - 1) * treeLevelIndent) }}
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
