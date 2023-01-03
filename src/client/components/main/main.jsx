
import { Component } from '../common/react-subx'
import Sessions from '../session/sessions'
import ContextMenu from '../context-menu/context-menu'
import FileInfoModal from '../sftp/file-props-modal'
import FileModeModal from '../sftp/file-mode-modal'
import UpdateCheck from './upgrade'
import SettingModal from '../setting-panel/setting-modal'
import TextEditor from '../text-editor/text-editor'
import Sidebar from '../sidebar'
import CssOverwrite from './css-overwrite'
import UiTheme from './ui-theme'
import TerminalInteractive from '../terminal/terminal-interactive'
import classnames from 'classnames'
import { isMac, isWin } from '../../common/constants'
import TermFullscreenControl from './term-fullscreen-control'
import { LoadingUI } from './loading'
import './wrapper.styl'

export default class Index extends Component {
  componentDidMount () {
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
    ipcOnEvent('window-move', store.onResize.bind(store))

    document.addEventListener('drop', function (e) {
      e.preventDefault()
      e.stopPropagation()
    })
    document.addEventListener('dragover', function (e) {
      e.preventDefault()
      e.stopPropagation()
    })
    window.addEventListener('offline', store.setOffline)
    store.zoom(store.config.zoom, false, true)
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
      installSrc
    } = store
    const cls = classnames({
      loaded: configLoaded,
      'system-ui': store.config.useSystemTitleBar,
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
      <div {...ext1}>
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
        <TextEditor />
        <UpdateCheck
          skipVersion={cpConf.skipVersion}
          upgradeInfo={upgradeInfo}
          installSrc={installSrc}
        />
        <ContextMenu store={store} />
        <FileInfoModal />
        <FileModeModal />
        <SettingModal store={store} />
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
      </div>
    )
  }
}
