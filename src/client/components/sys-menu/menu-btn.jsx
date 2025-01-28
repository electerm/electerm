/**
 * btns
 */

import { PureComponent } from 'react'
import {
  Popover
} from 'antd'
import logoRef from '@electerm/electerm-resource/res/imgs/electerm.svg'
import { shortcutDescExtend } from '../shortcuts/shortcut-handler.js'
import MenuRender from './sys-menu.jsx'
import { refsStatic } from '../common/ref.js'

const e = window.translate
const logo = logoRef.replace(/^\//, '')

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

  onNewWindow = () => {
    window.store.onNewWindow()
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
    return [
      {
        func: 'onNewSsh',
        icon: 'CodeFilled',
        text: e('newBookmark'),
        subText: this.getShortcut('app_newBookmark')
      },
      {
        func: 'addTab',
        icon: 'RightSquareFilled',
        text: e('newTab')
      },
      {
        func: 'onNewWindow',
        icon: 'WindowsOutlined',
        text: e('newWindow')
      },
      // {
      //   type: 'hr'
      // },
      {
        noCloseMenu: true,
        icon: 'BookOutlined',
        text: e('bookmarks'),
        submenu: 'Bookmark'
      },
      {
        noCloseMenu: true,
        icon: 'ClockCircleOutlined',
        text: e('history'),
        submenu: 'History'
      },
      {
        noCloseMenu: true,
        icon: 'BarsOutlined',
        text: e('sessions'),
        submenu: 'Tabs'
      },
      // {
      //   type: 'hr'
      // },
      {
        func: 'openAbout',
        icon: 'InfoCircleOutlined',
        text: e('about')
      },
      {
        func: 'openSetting',
        icon: 'SettingOutlined',
        text: e('settings')
      },
      {
        func: 'openDevTools',
        icon: 'LeftSquareFilled',
        text: e('toggledevtools')
      },
      // {
      //   type: 'hr'
      // },
      {
        module: 'Zoom'
      },
      {
        func: 'minimize',
        icon: 'SwitcherFilled',
        text: e('minimize')
      },
      {
        func: 'maximize',
        icon: 'LayoutFilled',
        text: e('maximize')
      },
      {
        func: 'reload',
        icon: 'ReloadOutlined',
        text: e('reload')
      },
      // {
      //   type: 'hr'
      // },
      {
        func: 'onCheckUpdate',
        icon: 'UpCircleOutlined',
        text: e('checkForUpdate')
      },
      // {
      //   type: 'hr'
      // },
      {
        func: 'restart',
        icon: 'RedoOutlined',
        text: e('restart')
      },
      {
        func: 'close',
        icon: 'CloseOutlined',
        text: e('close')
      }
    ]
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
          <img src={logo} width={28} height={28} />
        </div>
      </Popover>
    )
  }
}

export default shortcutDescExtend(MenuBtn)
