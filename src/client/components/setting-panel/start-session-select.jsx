import { TreeSelect, Tabs, Select, Empty } from 'antd'
import { useState } from 'react'
import copy from 'json-deep-copy'
import { createTitleWithTag } from '../../common/create-title'
import {
  AppstoreOutlined,
  BookOutlined
} from '@ant-design/icons'
import HelpIcon from '../common/help-icon'

const e = window.translate
const { SHOW_CHILD } = TreeSelect

function BookmarkSelect (props) {
  const {
    bookmarks,
    bookmarkGroups,
    onStartSessions,
    onChangeStartSessions
  } = props

  const buildData = () => {
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

  // onStartSessions is array for bookmarks
  const value = Array.isArray(onStartSessions) ? onStartSessions : []

  const rProps = {
    treeData: buildData(),
    value: copy(value),
    onChange: onChangeStartSessions,
    treeCheckable: true,
    showCheckedStrategy: SHOW_CHILD,
    placeholder: e('pleaseSelect'),
    style: {
      width: '100%'
    }
  }
  return (
    <TreeSelect {...rProps} />
  )
}

function WorkspaceSelect (props) {
  const {
    workspaces,
    onStartSessions,
    onChangeStartSessions
  } = props

  if (!workspaces.length) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={e('noWorkspaces')}
      />
    )
  }

  // onStartSessions is string for workspace
  const value = typeof onStartSessions === 'string' ? onStartSessions : undefined

  return (
    <Select
      value={value}
      onChange={onChangeStartSessions}
      placeholder={e('selectWorkspace')}
      style={{ width: '100%' }}
      allowClear
    >
      {workspaces.map(w => (
        <Select.Option key={w.id} value={w.id}>
          {w.name}
        </Select.Option>
      ))}
    </Select>
  )
}

export default function StartSessionSelect (props) {
  const {
    onStartSessions,
    bookmarks,
    bookmarkGroups,
    workspaces,
    onChangeStartSessions
  } = props

  // Determine initial tab based on what's configured
  // string = workspace, array = bookmarks
  const getInitialTab = () => {
    if (typeof onStartSessions === 'string' && onStartSessions) {
      return 'workspace'
    }
    return 'bookmarks'
  }

  const [activeTab, setActiveTab] = useState(getInitialTab)

  // When switching tabs, clear the value if needed
  const handleTabChange = (key) => {
    setActiveTab(key)
    // Reset to appropriate default when switching
    if (key === 'bookmarks' && typeof onStartSessions === 'string') {
      onChangeStartSessions([])
    } else if (key === 'workspace' && Array.isArray(onStartSessions)) {
      onChangeStartSessions(undefined)
    }
  }

  const tabItems = [
    {
      key: 'bookmarks',
      label: (
        <span>
          <BookOutlined /> {e('bookmarks')}
        </span>
      )
    },
    {
      key: 'workspace',
      label: (
        <span>
          <AppstoreOutlined /> {e('workspace')}
          <HelpIcon link='https://github.com/electerm/electerm/wiki/Workspace-Feature' />
        </span>
      )
    }
  ]

  return (
    <div>
      <Tabs
        items={tabItems}
        size='small'
        activeKey={activeTab}
        onChange={handleTabChange}
      />
      {activeTab === 'bookmarks'
        ? (
          <BookmarkSelect
            bookmarks={bookmarks}
            bookmarkGroups={bookmarkGroups}
            onStartSessions={onStartSessions}
            onChangeStartSessions={onChangeStartSessions}
          />
          )
        : (
          <WorkspaceSelect
            workspaces={workspaces}
            onStartSessions={onStartSessions}
            onChangeStartSessions={onChangeStartSessions}
          />
          )}
    </div>
  )
}
