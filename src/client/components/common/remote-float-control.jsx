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
    currentScreen,
    fixedPosition = true,
    showExitFullscreen = true,
    className = ''
  } = props

  if (fixedPosition && !isFullScreen) return null

  function onExitFullScreen () {
    window.store.toggleSessFullscreen(false)
  }

  const items = []

  if (showExitFullscreen && isFullScreen) {
    items.push({
      key: 'exit-fullscreen',
      label: e('exitFullscreen') || 'Exit Fullscreen',
      icon: <FullscreenExitOutlined />,
      onClick: onExitFullScreen
    })
  }

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

  const containerClassName = (fixedPosition ? 'remote-float-control' : 'remote-float-control-inline') + (className ? ' ' + className : '')
  const buttonClassName = fixedPosition ? 'remote-float-btn' : 'remote-float-btn-inline'
  const iconClassName = fixedPosition ? 'font20' : ''

  return (
    <div className={containerClassName}>
      <Dropdown menu={{ items }} trigger={['click']}>
        <div className={buttonClassName}>
          <MoreOutlined className={iconClassName} />
        </div>
      </Dropdown>
    </div>
  )
}
