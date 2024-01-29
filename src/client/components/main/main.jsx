import { Component } from '../common/react-subx'
import Sessions from '../session/sessions'
import ContextMenu from '../context-menu/context-menu'
import FileInfoModal from '../sftp/file-props-modal'
import FileModeModal from '../sftp/file-mode-modal'
import UpdateCheck from './upgrade'
import SettingModal from '../setting-panel/setting-modal'
import TextEditor from '../text-editor/text-editor'
import Sidebar from '../sidebar'
import BatchOp from '../batch-op/batch-op'
import CssOverwrite from './css-overwrite'
import UiTheme from './ui-theme'
import CustomCss from './custom-css.jsx'
import TerminalInteractive from '../terminal/terminal-interactive'
import classnames from 'classnames'
import ShortcutControl from '../shortcuts/shortcut-control.jsx'
import { isMac, isWin } from '../../common/constants'
import TermFullscreenControl from './term-fullscreen-control'
import { LoadingUI } from './loading'
import { ConfigProvider, notification } from 'antd'
import './wrapper.styl'

export default class Index extends Component {
  componentDidMount () {
    notification.config({
      placement: 'bottomRight'
    })
    const { store } = this.props
    window.addEventListener('resize', store.onResize)
    store.onResize()
    store.initStoreEvents()
    const { ipcOnEvent } = window.pre
    ipcOnEvent('checkupdate', store.onCheckUpdate)
    ipcOnEvent('open-about', store.openAbout)
    ipcOnEvent('new-ssh', store.onNewSsh)
    ipcOnEvent('add-tab-from-command-line', store.addTabFromCommandLine)
    ipcOnEvent('openSettings', store.openSetting)
    ipcOnEvent('selectall', store.selectall)
    ipcOnEvent('focused', store.focus)
    ipcOnEvent('blur', store.onBlur)
    ipcOnEvent('zoom-reset', store.onZoomReset)
    ipcOnEvent('zoomin', store.onZoomIn)
    ipcOnEvent('zoomout', store.onZoomout)

    document.addEventListener('drop', function (e) {
      e.preventDefault()
      e.stopPropagation()
    })
    document.addEventListener('dragover', function (e) {
      e.preventDefault()
      e.stopPropagation()
    })
    window.addEventListener('offline', store.setOffline)
    store.isSencondInstance = window.pre.runSync('isSencondInstance')
    store.initData()
    store.checkForDbUpgrade()
  }

  render () {
    const { store } = this.props
    const {
      configLoaded,
      config,
      terminalFullScreen,
      pinned,
      isSencondInstance,
      pinnedQuickCommandBar,
      wsInited,
      upgradeInfo,
      installSrc,
      uiThemeConfig
    } = store
    const cls = classnames({
      loaded: configLoaded,
      'system-ui': store.config.useSystemTitleBar,
      'not-system-ui': !store.config.useSystemTitleBar,
      'is-mac': isMac,
      'is-win': isWin,
      pinned,
      'qm-pinned': pinnedQuickCommandBar,
      'term-fullscreen': terminalFullScreen,
      'is-main': !isSencondInstance
    })
    const ext1 = {
      className: cls
    }
    const cpConf = config
    const confsCss = Object
      .keys((cpConf))
      .filter(d => d.startsWith('terminalBackground'))
      .reduce((p, k) => {
        return {
          ...p,
          [k]: cpConf[k]
        }
      }, {})
    const themeProps = {
      themeConfig: store.getUiThemeConfig()
    }
    const outerProps = {
      style: {
        opacity: config.opacity
      }
    }
    return (
      <ConfigProvider
        theme={uiThemeConfig}
      >
        <div {...ext1}>
          <ShortcutControl config={config} />
          <LoadingUI
            wsInited={wsInited}
          />
          <TermFullscreenControl
            terminalFullScreen={terminalFullScreen}
          />
          <CssOverwrite
            {...confsCss}
            wsInited={wsInited}
          />
          <TerminalInteractive />
          <UiTheme
            {...themeProps}
            buildTheme={store.buildTheme}
          />
          <CustomCss customCss={config.customCss} />
          <TextEditor customCss={cpConf.customCss} />
          <UpdateCheck
            skipVersion={cpConf.skipVersion}
            upgradeInfo={upgradeInfo}
            installSrc={installSrc}
          />
          <FileInfoModal />
          <FileModeModal />
          <SettingModal store={store} />
          <BatchOp store={store} />
          <div
            id='outside-context'
            {...outerProps}
          >
            <Sidebar store={store} />
            <Sessions
              store={store}
              config={cpConf}
            />
          </div>
          <ContextMenu store={store} />
        </div>
      </ConfigProvider>
    )
  }
}
