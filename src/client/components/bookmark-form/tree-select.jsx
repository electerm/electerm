import {
  Tree,
  Button,
  Space,
  Input
} from 'antd'
import { useState, useMemo, useEffect, useRef } from 'react'
import { defaultBookmarkGroupId, settingMap } from '../../common/constants'
import deepCopy from 'json-deep-copy'
import createTitle, { createTitleWithTag } from '../../common/create-title'
import buildMap from '../../common/build-map.js'
import { mapBookmarkGroupTree } from '../../common/bookmark-group-tree.js'
import time from '../../common/time'
import download from '../../common/download'

const e = window.translate

function collectParentKeys (nodes) {
  const keys = []
  const walk = list => {
    list.forEach(node => {
      if (node.children && node.children.length) {
        keys.push(node.key)
        walk(node.children)
      }
    })
  }
  walk(nodes || [])
  return keys
}

function buildData (bookmarks, bookmarkGroups, searchText = '') {
  const searchLower = searchText.toLowerCase()
  const bookmarkMap = buildMap(bookmarks)

  // Helper to check if a node matches the search
  function matchesSearch (text) {
    if (!searchText) return true
    const str = String(text || '')
    return str.toLowerCase().includes(searchLower)
  }

  function buildLeaf (id) {
    const x = bookmarkMap.get(id)
    if (!x) {
      return null
    }
    const titleText = createTitle(x)
    // Filter: only include leaf if it matches search
    if (searchText && !matchesSearch(titleText)) {
      return null
    }
    return {
      value: x.id,
      key: x.id,
      title: createTitleWithTag(x)
    }
  }

  return mapBookmarkGroupTree(bookmarkGroups, {
    mapBookmark: buildLeaf,
    mapGroup: (group, children) => {
      // Filter: include group if it matches or has matching children
      if (searchText && !matchesSearch(group.title || '') && !children.length) {
        return null
      }
      const node = {
        key: group.id,
        value: group.id,
        title: group.title
      }
      if (children.length) {
        node.children = children
      }
      return node
    }
  })
}

export default function BookmarkTreeSelect (props) {
  const { bookmarks, bookmarkGroups, type = 'delete', expandedKeys: propExpandedKeys, checkedKeys: propCheckedKeys } = props

  const [expandedKeys, setExpandedKeys] = useState(() => deepCopy(propExpandedKeys || []))
  const [checkedKeys, setCheckedKeys] = useState(() => deepCopy(propCheckedKeys || []))
  const [searchText, setSearchText] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const onCheck = setCheckedKeys

  const handleOperation = () => {
    const { store } = window
    const arr = checkedKeys.filter(d => d !== defaultBookmarkGroupId)
    if (type === 'delete') {
      store.delItems(arr, settingMap.bookmarks)
      store.delItems(arr, settingMap.bookmarkGroups)
      setRefreshKey(k => k + 1)
    } else {
      store.openBookmarks(arr)
      if (props.onClose) {
        props.onClose()
      }
    }
    setCheckedKeys([])
  }

  // checked keys contain both bookmark and bookmark group ids
  const selectedBookmarks = useMemo(() => {
    const keys = new Set(checkedKeys)
    return (bookmarks || []).filter(b => keys.has(b.id))
  }, [checkedKeys, bookmarks])

  const handleExport = () => {
    const stamp = time(undefined, 'YYYY-MM-DD-HH-mm-ss')
    const txt = JSON.stringify(deepCopy(selectedBookmarks), null, 2)
    download('bookmarks-' + stamp + '.json', txt)
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

  const treeData = useMemo(() => buildData(bookmarks, bookmarkGroups, searchText), [bookmarks, bookmarkGroups, searchText, refreshKey])

  // Search filters the tree data itself (not antd's filterTreeNode), so a match
  // inside a collapsed category would stay invisible: expand every branch that
  // survived the filter while a query is active, and hand the user their own
  // expansion back when the box is cleared.
  const preSearchKeys = useRef(null)
  useEffect(() => {
    if (searchText) {
      if (preSearchKeys.current === null) {
        preSearchKeys.current = expandedKeys
      }
      setExpandedKeys(collectParentKeys(treeData))
    } else if (preSearchKeys.current !== null) {
      setExpandedKeys(preSearchKeys.current)
      preSearchKeys.current = null
    }
  }, [searchText, treeData])

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
  const bLen = selectedBookmarks.length
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
          {
            type === 'delete' && (
              <Button
                disabled={!bLen}
                onClick={handleExport}
              >
                {e('export')} ({bLen})
              </Button>
            )
          }
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
