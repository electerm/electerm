import { auto } from 'manate/react'
import { useEffect } from 'react'
import Layout from '../layout/layout'
import FileInfoModal from '../sftp/file-info-modal'
import UpdateCheck from './upgrade'
import SettingModal from '../setting-panel/setting-modal'
import TextEditor from '../text-editor/text-editor'
import Sidebar from '../sidebar'
import BatchOp from '../batch-op/batch-op-entry'
import CssOverwrite from './css-overwrite'
import UiTheme from './ui-theme'
import CustomCss from './custom-css.jsx'
import Resolutions from '../rdp/resolution-edit'
import TerminalInteractive from '../terminal/terminal-interactive'
import ConfirmModalStore from '../sftp/confirm-modal-store.jsx'
import TransferConflictStore from '../sftp/transfer-conflict-store.jsx'
import TerminalCmdSuggestions from '../terminal/terminal-command-dropdown'
import TransportsActionStore from '../sftp/transports-action-store.jsx'
import classnames from 'classnames'
import ShortcutControl from '../shortcuts/shortcut-control.jsx'
import { isMac, isWin } from '../../common/constants'
import TermFullscreenControl from './term-fullscreen-control'
import TerminalInfo from '../terminal-info/terminal-info'
import { ConfigProvider, notification, message } from 'antd'
import InfoModal from '../sidebar/info-modal.jsx'
import RightSidePanel from '../side-panel-r/side-panel-r'
import ConnectionHoppingWarning from './connection-hopping-warnning'
import SshConfigLoadNotify from '../ssh-config/ssh-config-load-notify'
import LoadSshConfigs from '../ssh-config/load-ssh-configs'
import AIChat from '../ai/ai-chat'
import { pick } from 'lodash-es'
import deepCopy from 'json-deep-copy'
import './wrapper.styl'

function setupGlobalMessageDismiss () {
  document.addEventListener('click', (event) => {
    const messageElement = event.target.closest('.ant-message-notice')
    if (messageElement) {
      message.destroy()
    }
  })
}

export default auto(function Index (props) {
  useEffect(() => {
    notification.config({
      placement: 'bottomRight'
    })
    setupGlobalMessageDismiss()
    const { store } = props
    window.addEventListener('resize', store.onResize)
    setTimeout(store.triggerResize, 200)
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
    store.isSecondInstance = window.pre.runSync('isSecondInstance')
    store.initData()
    store.checkForDbUpgrade()
    // window.pre.runGlobalAsync('registerDeepLink')
  }, [])

  const { store } = props
  const {
    configLoaded,
    config,
    terminalFullScreen,
    pinned,
    isSecondInstance,
    pinnedQuickCommandBar,
    wsInited,
    installSrc,
    fileTransfers,
    uiThemeConfig,
    transferHistory,
    transferToConfirm,
    openResolutionEdit,
    rightPanelTitle,
    rightPanelTab
  } = store
  const upgradeInfo = deepCopy(store.upgradeInfo)
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
    'is-main': !isSecondInstance
  })
  const ext1 = {
    className: cls
  }
  const bgTabs = config.terminalBackgroundImagePath === 'index'
    ? store.getTabs()
    : store.getTabs().filter(tab =>
      tab.terminalBackground?.terminalBackgroundImagePath
    )
  const confsCss = {
    ...Object.keys(config)
      .filter(d => d.startsWith('terminalBackground'))
      .reduce((p, k) => ({
        ...p,
        [k]: config[k]
      }), {}),
    tabs: bgTabs.map(tab => {
      return {
        tabCount: tab.tabCount,
        terminalBackground: tab.terminalBackground,
        id: tab.id
      }
    })
  }
  const themeProps = {
    themeConfig: store.getUiThemeConfig()
  }
  const outerProps = {
    style: {
      opacity: config.opacity
    }
  }
  const copiedTransfer = deepCopy(fileTransfers)
  const copiedHistory = deepCopy(transferHistory)
  const sidebarProps = {
    ...pick(store, [
      'activeItemId',
      'history',
      'showModal',
      'showInfoModal',
      'openedSideBar',
      'height',
      'settingTab',
      'settingItem',
      'isSyncingSetting',
      'leftSidebarWidth',
      'transferTab',
      'sidebarPanelTab'
    ]),
    fileTransfers: copiedTransfer,
    transferHistory: copiedHistory,
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
    upgradeInfo: store.upgradeInfo
  }
  const conflictStoreProps = {
    fileTransferChanged: JSON.stringify(copiedTransfer),
    fileTransfers: copiedTransfer
  }
  const batchOpProps = {
    transferHistory,
    showModal: store.showModal,
    innerWidth: store.innerWidth
  }
  const resProps = {
    resolutions: deepCopy(store.resolutions),
    openResolutionEdit
  }

  const rightPanelProps = {
    rightPanelVisible: store.rightPanelVisible,
    rightPanelPinned: store.rightPanelPinned,
    rightPanelWidth: store.rightPanelWidth,
    title: rightPanelTitle,
    rightPanelTab
  }
  const terminalInfoProps = {
    rightPanelTab,
    ...deepCopy(store.terminalInfoProps),
    ...pick(
      config,
      [
        'host',
        'port',
        'saveTerminalLogToFile',
        'terminalInfos',
        'sessionLogPath'
      ]
    )
  }
  const sshConfigProps = {
    ...pick(store, [
      'settingTab',
      'showModal',
      'sshConfigs'
    ])
  }
  const warningProps = {
    hasOldConnectionHoppingBookmark: store.hasOldConnectionHoppingBookmark,
    configLoaded
  }
  const aiChatProps = {
    aiChatHistory: store.aiChatHistory,
    config,
    selectedTabIds: store.batchInputSelectedTabIds,
    tabs: store.getTabs(),
    activeTabId: store.activeTabId,
    showAIConfig: store.showAIConfig,
    rightPanelTab
  }
  const cmdSuggestionsProps = {
    suggestions: store.terminalCommandSuggestions
  }
  return (
    <ConfigProvider
      theme={uiThemeConfig}
    >
      <div {...ext1}>
        <ShortcutControl config={config} />
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
        <TextEditor />
        <UpdateCheck
          skipVersion={config.skipVersion}
          upgradeInfo={upgradeInfo}
          installSrc={installSrc}
        />
        <FileInfoModal />
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
        <RightSidePanel {...rightPanelProps}>
          <AIChat {...aiChatProps} />
          <TerminalInfo {...terminalInfoProps} />
        </RightSidePanel>
        <SshConfigLoadNotify {...sshConfigProps} />
        <LoadSshConfigs
          showSshConfigModal={store.showSshConfigModal}
          sshConfigs={store.sshConfigs}
        />
        <ConnectionHoppingWarning {...warningProps} />
        <TerminalCmdSuggestions {...cmdSuggestionsProps} />
      </div>
    </ConfigProvider>
  )
})
