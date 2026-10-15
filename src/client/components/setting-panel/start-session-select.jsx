import { TreeSelect, Tabs, Select, Empty } from 'antd'
import { useState } from 'react'
import copy from 'json-deep-copy'
import { createTitleWithTag } from '../../common/create-title'
import {
  AppstoreOutlined,
  BookOutlined
} from '@ant-design/icons'
import HelpIcon from '../common/help-icon'
import buildMap from '../../common/build-map.js'
import { mapBookmarkGroupTree } from '../../common/bookmark-group-tree.js'

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
    const bookmarkMap = buildMap(bookmarks)
    return mapBookmarkGroupTree(bookmarkGroups, {
      mapBookmark: id => {
        const x = bookmarkMap.get(id)
        if (!x) {
          return null
        }
        return {
          value: x.id,
          key: x.id,
          title: createTitleWithTag(x)
        }
      },
      mapGroup: (group, children) => {
        const node = {
          title: group.title,
          value: group.id,
          key: group.id
        }
        if (children.length) {
          node.children = children
        }
        return node
      }
    })
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
      placeholder={e('workspaces')}
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
      return 'workspaces'
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
    } else if (key === 'workspaces' && Array.isArray(onStartSessions)) {
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
      key: 'workspaces',
      label: (
        <span>
          <AppstoreOutlined /> {e('workspaces')}
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
