import React from 'react'
import {
  FullscreenExitOutlined,
  AppstoreOutlined,
  DesktopOutlined,
  MoreOutlined,
  DownOutlined
} from '@ant-design/icons'
import { Dropdown } from 'antd'
import './remote-float-control.styl'

const e = window.translate

export default function RemoteFloatControl (props) {
  const {
    isFullScreen,
    onSendCtrlAltDel,
    screens = [],
    onSelectScreen,
    currentScreen
  } = props

  if (!isFullScreen) return null

  function onExitFullScreen () {
    window.store.toggleSessFullscreen(false)
  }

  const items = [
    {
      key: 'exit-fullscreen',
      label: e('exitFullscreen') || 'Exit Fullscreen',
      icon: <FullscreenExitOutlined />,
      onClick: onExitFullScreen
    }
  ]

  if (onSendCtrlAltDel) {
    items.push({
      key: 'ctrl-alt-del',
      label: 'Send Ctrl+Alt+Del',
      icon: <AppstoreOutlined />,
      onClick: onSendCtrlAltDel
    })
  }

  if (screens && screens.length > 0) {
    items.push({
      key: 'screens',
      label: 'Select Screen',
      icon: <DesktopOutlined />,
      children: screens.map(s => ({
        key: s.id,
        label: s.name,
        onClick: () => onSelectScreen(s.id),
        icon: currentScreen === s.id ? <DownOutlined /> : null
      }))
    })
  }

  return (
    <div className='remote-float-control'>
      <Dropdown menu={{ items }} trigger={['click']}>
        <div className='remote-float-btn'>
          <MoreOutlined className='font20' />
        </div>
      </Dropdown>
    </div>
  )
}
