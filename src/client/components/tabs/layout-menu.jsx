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
import { splitMapDesc } from '../../common/constants'
import LayoutSelect, { getLayoutIcon } from './layout-select'
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
      key: 'workspace',
      label: (
        <span>
          <AppstoreOutlined /> {e('workspace')}
          <HelpIcon link='https://github.com/electerm/electerm/wiki/Workspace-Feature' />
        </span>
      )
    }
  ]

  const v = splitMapDesc[layout]
  const Icon = getLayoutIcon(v)

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
      <span className='tabs-dd-icon layout-dd-icon mg1l'>
        <Icon /> <DownOutlined />
      </span>
    </Dropdown>
  )
}
