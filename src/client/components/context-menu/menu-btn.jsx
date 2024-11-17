/**
 * btns
 */

import { PureComponent } from 'react'
import logoRef from '@electerm/electerm-resource/res/imgs/electerm.svg'
import { commonActions } from '../../common/constants'
import { shortcutDescExtend } from '../shortcuts/shortcut-handler.js'
import generate from '../../common/uid'

const e = window.translate
const logo = logoRef.replace(/^\//, '')

class MenuBtn extends PureComponent {
  state = {
    opened: false
  }

  onContextAction = e => {
    const {
      action,
      id,
      args = [],
      func
    } = e.data || {}
    if (
      action !== commonActions.clickContextMenu ||
      id !== this.uid ||
      !this[func]
    ) {
      return false
    }
    window.removeEventListener('message', this.onContextAction)
    this[func](...args)
  }

  openMenu = () => {
    const items = this.renderContext()
    this.uid = generate()
    window.store.openContextMenu({
      items,
      pos: {
        left: 40,
        top: 10
      },
      id: this.uid
    })
    window.addEventListener('message', this.onContextAction)
    this.setState({
      opened: true
    })
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

  render () {
    const pops = {
      className: 'menu-control',
      onMouseDown: evt => evt.preventDefault(),
      onClick: this.openMenu,
      title: e('menu')
    }
    return (
      <div
        key='menu-control'
        {...pops}
      >
        <img src={logo} width={28} height={28} />
      </div>
    )
  }
}

export default shortcutDescExtend(MenuBtn)
