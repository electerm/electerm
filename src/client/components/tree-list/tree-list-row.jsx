import TreeExpander from './tree-expander'
import TreeListItem from './tree-list-item'
import TreeItemOp from './tree-item-op'
import { treeLevelIndent } from './tree-list-layout'

export default function TreeListRow (props) {
  const {
    row,
    keyword,
    expandedKeys,
    activeItemId,
    searchSelectedRowKey,
    staticList,
    leftSidebarWidth,
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
  const isGroupExpanded = Boolean(keyword) || expandedKeys.includes(item.id)
  const itemProps = {
    item,
    isGroup,
    parentId,
    leftSidebarWidth,
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
          shouldOpen={isGroupExpanded}
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
