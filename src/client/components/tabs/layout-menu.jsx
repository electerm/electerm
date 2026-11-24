/**
 * Layout and Workspace menu dropdown component
 */

import React, { useState } from 'react'
import { Dropdown, Tabs } from 'antd'
import {
  AppstoreOutlined,
  LayoutOutlined
} from '@ant-design/icons'
import LayoutSelect from './layout-select'
import WorkspaceSelect from './workspace-select'
import HelpIcon from '../common/help-icon'

const e = window.translate

export default function LayoutMenu ({ layout, children }) {
  const [activeTab, setActiveTab] = useState('layout')
  const [open, setOpen] = useState(false)
  const selectLayout = key => {
    window.store.setLayout(key)
    setOpen(false)
  }

  const tabItems = [
    {
      key: 'layout',
      label: (
        <span>
          <LayoutOutlined /> {e('layout')}
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

  const dropdownContent = (
    <div className='layout-workspace-dropdown'>
      <Tabs
        items={tabItems}
        size='small'
        activeKey={activeTab}
        onChange={setActiveTab}
      />
      {activeTab === 'layout'
        ? <LayoutSelect layout={layout} onSelect={selectLayout} />
        : <WorkspaceSelect store={window.store} />}
    </div>
  )

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      popupRender={() => dropdownContent}
      placement='bottomRight'
      trigger={['click']}
    >
      {children}
    </Dropdown>
  )
}
