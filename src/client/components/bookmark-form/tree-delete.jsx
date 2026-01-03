import {
  Tree,
  Button,
  Space
} from 'antd'
import { defaultBookmarkGroupId, settingMap } from '../../common/constants'
import deepCopy from 'json-deep-copy'
import { createTitleWithTag } from '../../common/create-title'

const e = window.translate

function buildData (bookmarks, bookmarkGroups) {
  const cats = bookmarkGroups
  const tree = bookmarks
    .reduce((p, k) => {
      return {
        ...p,
        [k.id]: k
      }
    }, {})
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
      title: createTitleWithTag(x)
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
      return r
    }).filter(d => d)
  return level1
}

export default function BookmarkTreeDelete (props) {
  const { expandedKeys, checkedKeys, bookmarks, bookmarkGroups } = props

  const onExpand = (expandedKeys) => {
    window.store.expandedKeys = deepCopy(expandedKeys)
  }

  const onCheck = (checkedKeys) => {
    window.store.checkedKeys = deepCopy(checkedKeys)
  }

  const handleDel = () => {
    const { store } = window
    const arr = checkedKeys.filter(d => d !== defaultBookmarkGroupId)
    store.delItems(arr, settingMap.bookmarks)
    store.delItems(arr, settingMap.bookmarkGroups)
    store.checkedKeys = []
  }

  const handleCancel = () => {
    const { store } = window
    store.bookmarkSelectMode = false
    store.checkedKeys = []
  }

  const rProps = {
    checkable: true,
    autoExpandParent: true,
    onCheck,
    expandedKeys,
    checkedKeys,
    onExpand,
    treeData: buildData(bookmarks, bookmarkGroups)
  }
  const len = checkedKeys.length
  return (
    <div>
      <div className='pd2'>
        <Space.Compact>
          <Button
            type='primary'
            disabled={!len}
            onClick={handleDel}
          >
            {e('delSelected')} ({len})
          </Button>
          <Button
            onClick={handleCancel}
          >
            {e('cancel')}
          </Button>
        </Space.Compact>
        <Tree {...rProps} />
      </div>
    </div>
  )
}
