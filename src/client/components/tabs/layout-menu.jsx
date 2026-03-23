/**
 * Layout and Workspace menu dropdown component
 */

import React, { useState } from 'react'
import { Dropdown, Tabs } from 'antd'
import {
  DownOutlined,
  AppstoreOutlined,
  LayoutOutlined
} from '@ant-design/icons'
import LayoutSelect from './layout-select'
import WorkspaceSelect from './workspace-select'
import HelpIcon from '../common/help-icon'

const e = window.translate

export default function LayoutMenu (props) {
  const { layout, visible } = props
  const [activeTab, setActiveTab] = useState('layout')

  if (!visible) {
    return null
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
        ? <LayoutSelect layout={layout} />
        : <WorkspaceSelect store={window.store} />}
    </div>
  )

  return (
    <Dropdown
      popupRender={() => dropdownContent}
      placement='bottomRight'
      trigger={['click']}
    >
      <span
        className='tabs-dd-icon layout-dd-icon'
        title={e('layout')}
      >
        <LayoutOutlined className='layout-trigger-icon' />
        <DownOutlined className='layout-trigger-arrow' />
      </span>
    </Dropdown>
  )
}
