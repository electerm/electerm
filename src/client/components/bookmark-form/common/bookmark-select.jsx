// bookmark select tree (copied from legacy)
import createTitle from '../../../common/create-title'
import buildMap from '../../../common/build-map.js'
import { mapBookmarkGroupTree } from '../../../common/bookmark-group-tree.js'
import { TreeSelect } from 'antd'

const e = window.translate

const hoppingProps = [
  'host',
  'port',
  'username',
  'password',
  'privateKey',
  'privateKeyPath',
  'passphrase',
  'certificate',
  'certificatePath'
]

function buildTreeData (bookmarkGroups, bookmarkMap) {
  return mapBookmarkGroupTree(bookmarkGroups, {
    mapBookmark: id => {
      const x = bookmarkMap.get(id)
      if (!x) return null
      return { value: x.id, key: x.id, title: createTitle(x) }
    },
    mapGroup: (group, children) => {
      // a category with nothing under it is not a useful place to jump to
      if (!children.length) return null
      return {
        title: group.title,
        value: group.id,
        key: group.id,
        selectable: false, // Make categories non-selectable
        children
      }
    }
  })
}

export default function BookmarkSelect (props) {
  const { bookmarks, bookmarkGroups } = props
  const tree = buildMap(bookmarks)

  function onSelect (id) {
    const item = tree.get(id)
    if (item) {
      const selected = hoppingProps.reduce((p, k) => {
        if (item[k] !== undefined) {
          p[k] = item[k]
        }
        return p
      }, {})
      selected.bookmarkId = item.id
      props.onSelect(selected)
    }
  }

  function filterTreeNode (inputValue, treeNode) {
    if (treeNode.selectable === false) return false
    return treeNode.title && treeNode.title.toLowerCase().includes(inputValue.toLowerCase())
  }

  const treeData = buildTreeData(bookmarkGroups, tree)
  const treeProps = {
    treeData,
    onChange: onSelect,
    placeholder: e('chooseFromBookmarks'),
    showSearch: true,
    value: undefined,
    filterTreeNode
  }
  return (
    <TreeSelect {...treeProps} />
  )
}
