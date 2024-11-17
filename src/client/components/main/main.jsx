import { auto } from 'manate/react'
import { useEffect } from 'react'
import Layout from '../layout/layout'
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
import Resolutions from '../rdp/resolution-edit'
import TerminalInteractive from '../terminal/terminal-interactive'
import ConfirmModalStore from '../sftp/confirm-modal-store.jsx'
import TransferConflictStore from '../sftp/transfer-conflict-store.jsx'
import TransportsActionStore from '../sftp/transports-action-store.jsx'
import classnames from 'classnames'
import ShortcutControl from '../shortcuts/shortcut-control.jsx'
import { isMac, isWin } from '../../common/constants'
import TermFullscreenControl from './term-fullscreen-control'
import { LoadingUI } from './loading'
import { ConfigProvider, notification } from 'antd'
import InfoModal from '../sidebar/info-modal.jsx'
import { pick } from 'lodash-es'
import './wrapper.styl'

export default auto(function Index (props) {
  useEffect(() => {
    notification.config({
      placement: 'bottomRight'
    })
    const { store } = props
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
    ipcOnEvent('confirm-exit', store.beforeExitApp)

    document.addEventListener('drop', function (e) {
      e.preventDefault()
      e.stopPropagation()
    })
    document.addEventListener('dragover', function (e) {
      e.preventDefault()
      e.stopPropagation()
    })
    window.addEventListener('offline', store.setOffline)
    if (window.et.isWebApp) {
      window.onbeforeunload = store.beforeExit
    }
    store.isSencondInstance = window.pre.runSync('isSencondInstance')
    store.initData()
    store.checkForDbUpgrade()
    window.pre.runGlobalAsync('registerDeepLink')
  }, [])

  const { store } = props
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
    fileTransfers,
    uiThemeConfig,
    transferHistory,
    transferToConfirm,
    openResolutionEdit
  } = store
  const cls = classnames({
    loaded: configLoaded,
    'not-webapp': !window.et.isWebApp,
    'system-ui': store.config.useSystemTitleBar,
    'not-system-ui': !store.config.useSystemTitleBar,
    'is-mac': isMac,
    'not-mac': !isMac,
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
  const sidebarProps = {
    ...pick(store, [
      'showModal',
      'showInfoModal',
      'openedSideBar',
      'height',
      'settingTab',
      'settingItem',
      'isSyncingSetting',
      'leftSidebarWidth',
      'transferTab'
    ]),
    fileTransfers,
    transferHistory,
    upgradeInfo,
    pinned
  }

  const infoModalProps = {
    ...pick(store, [
      'infoModalTab',
      'showInfoModal',
      'commandLineHelp'
    ]),
    installSrc,
    upgradeInfo
  }
  const conflictStoreProps = {
    fileTransfers,
    _fileTransfers: store._fileTransfers
  }
  const batchOpProps = {
    transferHistory,
    showModal: store.showModal,
    innerWidth: store.innerWidth
  }
  const resProps = {
    resolutions: store.resolutions,
    openResolutionEdit
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
        <BatchOp {...batchOpProps} />
        <div
          id='outside-context'
          {...outerProps}
        >
          <Sidebar {...sidebarProps} />
          <Layout
            store={store}
          />
        </div>
        <ContextMenu />
        <ConfirmModalStore
          transferToConfirm={transferToConfirm}
        />
        <TransferConflictStore
          {...conflictStoreProps}
          transferToConfirm={transferToConfirm}
        />
        <TransportsActionStore
          {...conflictStoreProps}
          config={config}
        />
        <Resolutions {...resProps} />
        <InfoModal {...infoModalProps} />
      </div>
    </ConfigProvider>
  )
})
