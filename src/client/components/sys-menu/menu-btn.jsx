/**
 * btns
 */

import { PureComponent } from 'react'
import {
  Popover
} from 'antd'
import logoSvg from '@electerm/electerm-resource/res/imgs/electerm.svg?raw'
import { shortcutDescExtend } from '../shortcuts/shortcut-handler.js'
import MenuRender from './sys-menu.jsx'
import { refsStatic } from '../common/ref.js'

const e = window.translate

class MenuBtn extends PureComponent {
  componentDidMount () {
    refsStatic.add('menu-btn', this)
  }

  onNewSsh = () => {
    window.store.onNewSsh()
  }

  addTab = () => {
    window.store.addTab()
  }

  openAbout = () => {
    window.store.openAbout()
  }

  openSetting = () => {
    window.store.openSetting()
  }

  openDevTools = () => {
    window.pre.runGlobalAsync('openDevTools')
  }

  minimize = () => {
    window.pre.runGlobalAsync('minimize')
  }

  maximize = () => {
    window.pre.runGlobalAsync('maximize')
  }

  reload = () => {
    window.location.reload()
  }

  onCheckUpdate = () => {
    window.store.onCheckUpdate()
  }

  restart = () => {
    window.store.restart()
  }

  close = () => {
    window.store.exit()
  }

  renderContext = () => {
    const items = [
      {
        key: 'onNewSsh',
        func: 'onNewSsh',
        icon: 'CodeFilled',
        text: e('newBookmark'),
        subText: this.getShortcut('app_newBookmark')
      }
    ]
    if (window.store.hasNodePty) {
      items.push({
        key: 'addTab',
        func: 'addTab',
        icon: 'RightSquareFilled',
        text: e('newTab'),
        subText: this.getShortcut('app_newTab')
      })
    }
    // {
    //   type: 'hr'
    // },
    items.push({
      key: 'bookmarks',
      noCloseMenu: true,
      icon: 'BookOutlined',
      text: e('bookmarks'),
      submenu: 'Bookmark'
    })
    items.push(
      {
        key: 'history',
        noCloseMenu: true,
        icon: 'ClockCircleOutlined',
        text: e('history'),
        submenu: 'History'
      },
      {
        key: 'sessions',
        noCloseMenu: true,
        icon: 'BarsOutlined',
        text: e('sessions'),
        submenu: 'Tabs'
      },
      {
        key: 'layout',
        icon: 'AppstoreOutlined',
        text: e('layout'),
        submenu: 'Layout'
      },
      // {
      //   type: 'hr'
      // },
      {
        key: 'openAbout',
        func: 'openAbout',
        icon: 'InfoCircleOutlined',
        text: e('about')
      },
      {
        key: 'openSetting',
        func: 'openSetting',
        icon: 'SettingOutlined',
        text: e('settings')
      },
      {
        key: 'openDevTools',
        func: 'openDevTools',
        icon: 'LeftSquareFilled',
        text: e('toggledevtools')
      },
      // {
      //   type: 'hr'
      // },
      {
        key: 'zoom',
        module: 'Zoom'
      },
      {
        key: 'minimize',
        func: 'minimize',
        icon: 'SwitcherFilled',
        text: e('minimize')
      },
      {
        key: 'maximize',
        func: 'maximize',
        icon: 'LayoutFilled',
        text: e('maximize')
      },
      {
        key: 'reload',
        func: 'reload',
        icon: 'ReloadOutlined',
        text: e('reload')
      },
      // {
      //   type: 'hr'
      // },
      {
        key: 'onCheckUpdate',
        func: 'onCheckUpdate',
        icon: 'UpCircleOutlined',
        text: e('checkForUpdate')
      },
      // {
      //   type: 'hr'
      // },
      {
        key: 'restart',
        func: 'restart',
        icon: 'RedoOutlined',
        text: e('restart')
      },
      {
        key: 'close',
        func: 'close',
        icon: 'CloseOutlined',
        text: e('close')
      }
    )
    return this.filterMenus(items)
  }

  // Only show menus listed in window.et.sysMenus, when it is defined,
  // eg: window.et.sysMenus = ['onNewSsh', 'bookmarks', 'openSetting', 'close']
  // available keys: onNewSsh, addTab, bookmarks, history, sessions, layout,
  // openAbout, openSetting, openDevTools, zoom, minimize, maximize, reload,
  // onCheckUpdate, restart, close
  filterMenus = (items) => {
    const { sysMenus } = window.et || {}
    if (!Array.isArray(sysMenus)) {
      return items
    }
    return items.filter(d => d.type === 'hr' || sysMenus.includes(d.key))
  }

  renderMenu () {
    const { store } = window
    const rprops = {
      items: this.renderContext(),
      tabs: store.getTabs(),
      config: store.config,
      history: store.history
    }
    return (
      <MenuRender {...rprops} />
    )
  }

  render () {
    const pops = {
      className: 'menu-control',
      onMouseDown: evt => evt.preventDefault(),
      onClick: this.openMenu,
      title: e('menu')
    }
    const popProps = {
      content: this.renderMenu(),
      // open: this.state.opened,
      placement: 'right',
      trigger: ['click']
    }
    return (
      <Popover {...popProps}>
        <div
          {...pops}
        >
          <span
            className='menu-logo'
            dangerouslySetInnerHTML={{ __html: logoSvg }}
          />
        </div>
      </Popover>
    )
  }
}

export default shortcutDescExtend(MenuBtn)
