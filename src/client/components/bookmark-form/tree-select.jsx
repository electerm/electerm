import {
  Tree,
  Button,
  Space,
  Input
} from 'antd'
import { useState, useMemo } from 'react'
import { defaultBookmarkGroupId, settingMap } from '../../common/constants'
import deepCopy from 'json-deep-copy'
import createTitle, { createTitleWithTag } from '../../common/create-title'

const e = window.translate

function buildData (bookmarks, bookmarkGroups, searchText = '') {
  const searchLower = searchText.toLowerCase()
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

  // Helper to check if a node matches the search
  function matchesSearch (text) {
    if (!searchText) return true
    const str = String(text || '')
    return str.toLowerCase().includes(searchLower)
  }

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
    // Filter: include node if it matches or has matching children
    if (searchText) {
      const titleMatches = matchesSearch(x.title || '')
      const hasMatchingChildren = y.children && y.children.length > 0
      if (!titleMatches && !hasMatchingChildren) {
        return ''
      }
    }
    return y
  }
  function buildLeaf (id) {
    const x = tree[id]
    if (!x) {
      return ''
    }
    const titleText = createTitle(x)
    // Filter: only include leaf if it matches search
    if (searchText && !matchesSearch(titleText)) {
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
      const children = [
        ...(d.bookmarkGroupIds || []).map(buildSubCats),
        ...(d.bookmarkIds || []).map(buildLeaf)
      ].filter(d => d)
      // Filter: include group if it matches or has matching children
      if (searchText) {
        const titleMatches = matchesSearch(d.title || '')
        const hasMatchingChildren = children.length > 0
        if (!titleMatches && !hasMatchingChildren) {
          return null
        }
      }
      const r = {
        title: d.title,
        value: d.id,
        key: d.id,
        children
      }
      if (r.children && !r.children.length) {
        delete r.children
      }
      return r
    }).filter(d => d)
  return level1
}

export default function BookmarkTreeSelect (props) {
  const { bookmarks, bookmarkGroups, type = 'delete', expandedKeys: propExpandedKeys, checkedKeys: propCheckedKeys } = props

  const [expandedKeys, setExpandedKeys] = useState(() => deepCopy(propExpandedKeys || []))
  const [checkedKeys, setCheckedKeys] = useState(() => deepCopy(propCheckedKeys || []))
  const [searchText, setSearchText] = useState('')

  const onCheck = setCheckedKeys

  const handleOperation = () => {
    const { store } = window
    const arr = checkedKeys.filter(d => d !== defaultBookmarkGroupId)
    if (type === 'delete') {
      store.delItems(arr, settingMap.bookmarks)
      store.delItems(arr, settingMap.bookmarkGroups)
    } else {
      store.openBookmarks(arr)
      if (props.onClose) {
        props.onClose()
      }
    }
    setCheckedKeys([])
  }

  const handleCancel = () => {
    const { store } = window
    if (props.onClose) {
      props.onClose()
    } else {
      store.bookmarkSelectMode = false
    }
    setCheckedKeys([])
  }

  const treeData = useMemo(() => buildData(bookmarks, bookmarkGroups, searchText), [bookmarks, bookmarkGroups, searchText])

  // Auto expand parent nodes when searching
  const handleExpand = (keys) => {
    setExpandedKeys(keys)
  }

  const rProps = {
    checkable: true,
    autoExpandParent: true,
    onCheck,
    expandedKeys,
    checkedKeys,
    onExpand: handleExpand,
    treeData
  }
  const len = checkedKeys.length
  return (
    <div className='tree-select-wrapper pd2'>
      <div className='tree-select-header'>
        <Space.Compact className='mg2b'>
          <Input.Search
            placeholder={e('search') || 'Search...'}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{ flex: 1 }}
          />
        </Space.Compact>
        <Space.Compact className='mg2b'>
          <Button
            type='primary'
            disabled={!len}
            onClick={handleOperation}
          >
            {type === 'delete' ? e('delSelected') : e('open')} ({len})
          </Button>
          <Button
            onClick={handleCancel}
          >
            {e('cancel')}
          </Button>
        </Space.Compact>
      </div>
      <div className='tree-select-content'>
        <Tree {...rProps} />
      </div>
    </div>
  )
}
