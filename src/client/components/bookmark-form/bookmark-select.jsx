// bookmark select tree
import createTitle from '../../common/create-title'
import { TreeSelect } from 'antd'

const e = window.translate

function buildTreeData (bookmarkGroups, tree) {
  const cats = bookmarkGroups
  const btree = cats
    .reduce((p, k) => {
      return {
        ...p,
        [k.id]: k
      }
    }, {})
  function buildSubCats (id) {
    const x = btree[id]
    if (!x) {
      return ''
    }
    const y = {
      key: x.id,
      value: x.id,
      title: x.title
    }
    y.children = [
      ...(x.bookmarkGroupIds || []).map(buildSubCats),
      ...(x.bookmarkIds || []).map(buildLeaf)
    ].filter(d => d)
    if (y.children && !y.children.length) {
      delete y.children
    }
    return y
  }
  function buildLeaf (id) {
    const x = tree[id]
    if (!x) {
      return ''
    }
    return {
      value: x.id,
      key: x.id,
      title: createTitle(x)
    }
  }
  const level1 = cats.filter(d => d.level !== 2)
    .map(d => {
      const r = {
        title: d.title,
        value: d.id,
        key: d.id,
        children: [
          ...(d.bookmarkGroupIds || []).map(buildSubCats),
          ...(d.bookmarkIds || []).map(buildLeaf)
        ].filter(d => d)
      }
      if (!r.children.length) {
        return ''
      }
      return r
    }).filter(d => d)
  return level1
}

export default function BookmarkSelect (props) {
  const {
    bookmarks,
    bookmarkGroups
  } = props
  const tree = bookmarks
    .reduce((p, k) => {
      return {
        ...p,
        [k.id]: k
      }
    }, {})

  function onSelect (id) {
    const item = tree[id]
    if (item) {
      item.bookmarkId = item.id
      props.onSelect(item)
    }
  }
  const treeData = buildTreeData(bookmarkGroups, tree)
  const treeProps = {
    treeData,
    onChange: onSelect,
    placeholder: e('chooseFromBookmarks'),
    showSearch: true,
    value: undefined
  }
  return (
    <TreeSelect {...treeProps} />
  )
}
