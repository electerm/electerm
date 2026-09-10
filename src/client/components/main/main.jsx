import { auto } from 'manate/react'
import { lazy, Suspense, useEffect } from 'react'
import Layout from '../layout/layout'
import FileInfoModal from '../sftp/file-info-modal'
import FileCompareModal from '../sftp/file-compare-modal'
import UpdateCheck from './upgrade'
import SettingModal from '../setting-panel/setting-modal'
import TextEditor from '../text-editor/text-editor-entry'
import Sidebar from '../sidebar'
import CssOverwrite from '../bg/css-overwrite'
import UiTheme from './ui-theme'
import CustomCss from '../bg/custom-css.jsx'
import TerminalInteractive from '../terminal/terminal-interactive'
import ConfirmModalStore from '../file-transfer/conflict-resolve.jsx'
import TransferQueue from '../file-transfer/transfer-queue'
import Remote2RemoteHandlers from '../file-transfer/remote2remote-handlers.jsx'
import TerminalCmdSuggestions from '../terminal/terminal-command-dropdown'
import TransportsActionStore from '../file-transfer/transports-action-store.jsx'
import classnames from 'classnames'
import ShortcutControl from '../shortcuts/shortcut-control.jsx'
import {
  footerHeight,
  isMac,
  isWin,
  remoteMonitorBarHeight,
  textTerminalBgValue
} from '../../common/constants'
import { isAIDisabled } from '../../common/ai-feature'
import { ConfigProvider } from 'antd'
import { NotificationContainer } from '../common/notification'
import RightSidePanel from '../side-panel-r/side-panel-r'
import ConnectionHoppingWarning from './connection-hopping-warnning'
import SshConfigLoadNotify from '../ssh-config/ssh-config-load-notify'
import LoadSshConfigs from '../ssh-config/load-ssh-configs'
import AIChat from '../ai/ai-chat-entry'
import MoveItemModal from '../tree-list/move-item-modal'
import InputContextMenu from '../common/input-context-menu'
import WorkspaceSaveModal from '../tabs/workspace-save-modal'
import BookmarkFromHistoryModal from '../bookmark-form/bookmark-from-history-modal'
import AutoSync from '../setting-sync/auto-sync'
import BatchOpRunner from '../batch-op/batch-op-runner'
import UnixTimestampTooltip from '../terminal/unix-timestamp-tooltip'
import ImportProgress from '../common/import-progress.jsx'
import { pick } from 'lodash-es'
import deepCopy from 'json-deep-copy'
import './wrapper.styl'
import TerminalInfo from '../terminal-info/terminal-info-entry'
import ShortcutBarEntry from '../terminal/shortcut-bar-entry'
import LazyBoundary from '../common/lazy-boundary'
import { isRemoteMonitorBarVisible } from '../remote-monitor/visibility'
import '../../common/fs.js'
import './term-fullscreen.styl'

const Resolutions = lazy(() => import('../rdp/resolution-edit'))
const InfoModal = lazy(() => import('../sidebar/info-modal.jsx'))
const AIConfigModal = lazy(() => import('../ai/ai-config-modal'))
// window opacity is electron-only: lazy so the web app never loads the chunk
const Opacity = lazy(() => import('../common/opacity'))

export default auto(function Index (props) {
  useEffect(() => {
    const { store } = props
    window.addEventListener('resize', store.onResize)
    setTimeout(store.triggerResize, 200)
    const { ipcOnEvent } = window.pre
    ipcOnEvent('checkupdate', store.onCheckUpdate)
    ipcOnEvent('open-about', store.openAbout)
    ipcOnEvent('new-ssh', store.onNewSsh)
    ipcOnEvent('add-tab-from-command-line', store.addTabFromCommandLine)
    ipcOnEvent('open-tab', (e, parsed) => store.ipcOpenTab(parsed))
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
    store.handleGetSerials()
    store.checkPendingDeepLink()
  }, [])

  // Track the actual input modality rather than a static capability probe:
  // a touch-capable laptop is a mouse machine until a real touch happens,
  // and a tablet stays touch even though it can also pair a mouse. Stored in
  // `store.isTouchDevice` (seeded false — no upfront probe, which only says
  // the screen *can* be touched, not what the user operates with); the
  // `is-touch-device` class drives always-visible hover-only action icons, so
  // it must follow the device the user is actually operating.
  useEffect(() => {
    const { store } = window
    const handlePointer = (e) => {
      if (e.pointerType === 'mouse') {
        store.isTouchDevice = false
      } else if (e.pointerType === 'touch' || e.pointerType === 'pen') {
        store.isTouchDevice = true
      }
    }
    document.addEventListener('pointerdown', handlePointer)
    document.addEventListener('pointermove', handlePointer)
    return () => {
      document.removeEventListener('pointerdown', handlePointer)
      document.removeEventListener('pointermove', handlePointer)
    }
  }, [])

  const { store } = props
  const {
    configLoaded,
    config,
    fullscreen,
    pinned,
    isSecondInstance,
    pinnedQuickCommandBar,
    installSrc,
    fileTransfers,
    uiThemeConfig,
    transferHistory,
    transferToConfirm,
    openResolutionEdit,
    rightPanelTitle,
    rightPanelTab,
    widgetInstances
  } = store
  const upgradeInfo = deepCopy(store.upgradeInfo)
  const remoteMonitorBarVisible = isRemoteMonitorBarVisible(store)
  const cls = classnames({
    loaded: configLoaded,
    'not-webapp': !window.et.isWebApp,
    'system-ui': store.config.useSystemTitleBar,
    'not-system-ui': !store.config.useSystemTitleBar,
    'is-mac': isMac,
    'not-mac': !isMac,
    'is-win': isWin,
    pinned,
    'not-win': !isWin,
    'qm-pinned': pinnedQuickCommandBar,
    fullscreen,
    // terminal fullscreen keeps the footer visible (rdp/vnc/spice fullscreen
    // does not — the footer would be an empty bar there)
    'fs-with-footer': fullscreen && store.inActiveTerminal,
    'is-main': !isSecondInstance,
    'is-mobile': store.isMobile,
    'is-desktop': !store.isMobile,
    'is-touch-device': store.isTouchDevice,
    'remote-monitor-bar-on': remoteMonitorBarVisible
  })
  const ext1 = {
    className: cls,
    style: {
      '--left-side-bar-width': store.leftSideBarWidth + 'px',
      '--footer-stack-height': `${footerHeight + (remoteMonitorBarVisible ? remoteMonitorBarHeight : 0)}px`
    }
  }
  // Get active tab IDs
  const activeTabIds = [
    store.activeTabId0,
    store.activeTabId1,
    store.activeTabId2,
    store.activeTabId3
  ].filter(Boolean) // Remove empty strings

  const bgTabs = config.terminalBackgroundImagePath === 'index' ||
                  config.terminalBackgroundImagePath === 'randomShape' ||
                  config.terminalBackgroundImagePath === textTerminalBgValue
    ? store.getTabs().filter(tab => activeTabIds.includes(tab.id))
    : store.getTabs().filter(tab =>
      activeTabIds.includes(tab.id) && tab.terminalBackground?.terminalBackgroundImagePath
    )
  const confsCss = {
    ...Object.keys(config)
      .filter(d => d.startsWith('terminalBackground'))
      .reduce((p, k) => ({
        ...p,
        [k]: config[k]
      }), {}),
    activeTabIds,
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
      'leftSidePanelWidth',
      'leftSideBarWidth',
      'transferTab',
      'sidebarPanelTab',
      'openWidgetsModal'
    ]),
    zoom: config.zoom,
    fileTransfers: copiedTransfer,
    transferHistory: copiedHistory,
    upgradeInfo,
    pinned,
    leftSideBarIcons: config.leftSideBarIcons,
    widgetInstancesLength: widgetInstances.length
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
    rightPanelTab,
    agentRunning: store.agentRunning,
    currentChatSessionId: store.currentChatSessionId,
    showChatSessions: store.showChatSessions
  }
  const cmdSuggestionsProps = {
    suggestions: store.terminalCommandSuggestions
  }
  return (
    <ConfigProvider
      theme={uiThemeConfig}
    >
      <div {...ext1}>
        <InputContextMenu />
        <ShortcutControl config={config} />
        <CssOverwrite
          {...confsCss}
          configLoaded={configLoaded}
        />
        {window.et.isWebApp
          ? null
          : (
            <LazyBoundary>
              <Suspense fallback={null}>
                <Opacity opacity={config.opacity} />
              </Suspense>
            </LazyBoundary>
            )}
        <TerminalInteractive />
        <UiTheme
          {...themeProps}
        />
        <CustomCss customCss={config.customCss} configLoaded={configLoaded} />
        {store.textEditorRequested && (
          <TextEditor />
        )}
        <UpdateCheck
          skipVersion={config.skipVersion}
          upgradeInfo={upgradeInfo}
          installSrc={installSrc}
        />
        <FileInfoModal />
        <FileCompareModal />
        <SettingModal store={store} />
        <MoveItemModal store={store} />
        <div
          id='outside-context'
        >
          <Sidebar {...sidebarProps} />
          <Layout
            store={store}
          />
        </div>
        <ConfirmModalStore
          transferToConfirm={transferToConfirm}
        />
        <TransportsActionStore
          {...conflictStoreProps}
          config={config}
        />
        <Remote2RemoteHandlers />
        {openResolutionEdit && (
          <LazyBoundary>
            <Suspense fallback={null}>
              <Resolutions {...resProps} />
            </Suspense>
          </LazyBoundary>
        )}
        {store.showInfoModal && (
          <LazyBoundary>
            <Suspense fallback={null}>
              <InfoModal {...infoModalProps} />
            </Suspense>
          </LazyBoundary>
        )}
        <RightSidePanel {...rightPanelProps}>
          {!isAIDisabled() && <AIChat {...aiChatProps} />}
          <TerminalInfo key={store.activeTabId} store={store} {...deepCopy(store.terminalInfoProps)} />
        </RightSidePanel>
        <SshConfigLoadNotify {...sshConfigProps} />
        <LoadSshConfigs
          showSshConfigModal={store.showSshConfigModal}
          sshConfigs={store.sshConfigs}
        />
        <ConnectionHoppingWarning {...warningProps} />
        <TerminalCmdSuggestions {...cmdSuggestionsProps} />
        <TransferQueue />
        <AutoSync config={config} />
        <WorkspaceSaveModal store={store} />
        <BookmarkFromHistoryModal />
        <NotificationContainer />
        <BatchOpRunner />
        <ImportProgress />
        <ShortcutBarEntry store={store} />
        {!isAIDisabled() && store.showAIConfigModal && (
          <LazyBoundary>
            <Suspense fallback={null}>
              <AIConfigModal store={store} />
            </Suspense>
          </LazyBoundary>
        )}
        <UnixTimestampTooltip />
      </div>
    </ConfigProvider>
  )
})
