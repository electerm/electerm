import { Book, RefreshCw, Info, Image, PlusCircle, Settings, ArrowUpCircle, Menu, LayoutGrid, Zap } from 'lucide-react'
import { Tooltip, Popover } from 'antd'
import SideBarPanel from './sidebar-panel'
import TransferList from './transfer-list'
import MenuBtn from '../sys-menu/menu-btn'
import QuickConnect from '../tabs/quick-connect'
import {
  sidebarWidth,
  settingMap,
  modals
} from '../../common/constants'
import SideIcon from './side-icon'
import SidePanel from './side-panel'
import hasActiveInput from '../../common/has-active-input'
import './sidebar.styl'

const e = window.translate

export default function Sidebar (props) {
  const {
    height,
    upgradeInfo,
    settingTab,
    settingItem,
    isSyncingSetting,
    leftSidebarWidth,
    pinned,
    fileTransfers,
    openedSideBar,
    transferHistory,
    transferTab,
    showModal,
    showInfoModal,
    sidebarPanelTab,
    openWidgetsModal
  } = props

  const { store } = window

  const handleClickOutside = (event) => {
    // Don't close if pinned or has active input
    if (store.pinned || hasActiveInput()) {
      return
    }

    // Check if click is outside the sidebar panel
    const sidebarPanel = document.querySelector('.sidebar-panel')
    if (sidebarPanel && !sidebarPanel.contains(event.target)) {
      store.setOpenedSideBar('')
      document.removeEventListener('click', handleClickOutside)
    }
  }

  const handleClickBookmark = () => {
    if (showModal) {
      store.showModal = 0
    }
    if (pinned) {
      return
    }
    if (openedSideBar === 'bookmarks') {
      // Remove listener when closing
      document.removeEventListener('click', handleClickOutside)
      store.setOpenedSideBar('')
    } else {
      // Add listener when opening, with slight delay to avoid conflict with this click
      setTimeout(() => {
        document.addEventListener('click', handleClickOutside)
      }, 0)
      store.setOpenedSideBar('bookmarks')
    }
  }

  const handleShowUpgrade = () => {
    window.store.upgradeInfo.showUpgradeModal = true
  }

  const {
    onNewSsh,
    openSetting,
    openAbout,
    openSettingSync,
    openTerminalThemes,
    toggleBatchOp,
    setLeftSidePanelWidth
  } = store
  const {
    showUpgradeModal,
    upgradePercent,
    checkingRemoteVersion,
    shouldUpgrade
  } = upgradeInfo
  const showSetting = showModal === modals.setting
  const showBatchOp = showModal === modals.batchOps
  const settingActive = showSetting && settingTab === settingMap.setting && settingItem.id === 'setting-common'
  const syncActive = showSetting && settingTab === settingMap.setting && settingItem.id === 'setting-sync'
  const themeActive = showSetting && settingTab === settingMap.terminalThemes
  const bookmarksActive = showSetting && settingTab === settingMap.bookmarks
  const widgetsActive = showSetting && settingTab === settingMap.widgets
  const sideProps = openedSideBar
    ? {
        className: 'sidebar-list',
        style: {
          width: `${leftSidebarWidth}px`
        }
      }
    : {
        className: 'sidebar-list'
      }
  const sidebarProps = {
    className: `sidebar type-${openedSideBar}`,
    style: {
      width: sidebarWidth,
      height
    }
  }
  const transferProps = {
    fileTransfers,
    transferTab,
    transferHistory
  }
  return (
    <div {...sidebarProps}>
      <div className='sidebar-bar btns'>
        <div className='control-icon-wrap'>
          <MenuBtn store={store} config={store.config} />
        </div>
        <SideIcon
          title={e('newBookmark')}
        >
          <PlusCircle
            className='iblock control-icon'
            onClick={onNewSsh}
          />
        </SideIcon>
        <Popover
          content={<QuickConnect inputOnly />}
          trigger='click'
          placement='right'
        >
          <div className='control-icon-wrap' title={e('quickConnect')}>
            <Zap
              className='iblock control-icon'
            />
          </div>
        </Popover>
        <SideIcon
          title={e(settingMap.bookmarks)}
          active={bookmarksActive}
        >
          <Book
            onClick={handleClickBookmark}
            className='iblock control-icon'
          />
        </SideIcon>
        <TransferList {...transferProps} />
        <SideIcon
          title={e(settingMap.terminalThemes)}
          active={themeActive}
        >
          <Image
            className='iblock pointer control-icon'
            onClick={openTerminalThemes}
          />
        </SideIcon>
        <SideIcon
          title={e(settingMap.setting)}
          active={settingActive}
        >
          <Settings className='iblock control-icon' onClick={openSetting} />
        </SideIcon>
        <SideIcon
          title={e('settingSync')}
          active={syncActive}
        >
          <RefreshCw
            className={`iblock control-icon ${isSyncingSetting ? 'anticon-spin' : ''}`}
            onClick={openSettingSync}
          />
        </SideIcon>
        <SideIcon
          title={e('batchOp')}
          active={showBatchOp}
        >
          <Menu className='iblock control-icon' onClick={toggleBatchOp} />
        </SideIcon>
        <SideIcon
          title={e('widgets')}
          active={widgetsActive}
        >
          <LayoutGrid className='iblock control-icon' onClick={openWidgetsModal} />
        </SideIcon>

        <SideIcon
          title={e('about')}
          active={showInfoModal}
        >
          <Info
            className='iblock control-icon open-about-icon'
            onClick={openAbout}
          />
        </SideIcon>
        {
          !checkingRemoteVersion && !showUpgradeModal && shouldUpgrade
            ? (
              <Tooltip
                title={`${e('upgrading')} ${upgradePercent || 0}%`}
                placement='right'
              >
                <div
                  className='control-icon-wrap'
                >
                  <ArrowUpCircle
                    className='iblock control-icon upgrade-icon'
                    onClick={handleShowUpgrade}
                  />
                </div>
              </Tooltip>
              )
            : null
        }
      </div>
      <SidePanel
        sideProps={sideProps}
        setLeftSidePanelWidth={setLeftSidePanelWidth}
        leftSidebarWidth={leftSidebarWidth}
      >
        <SideBarPanel
          pinned={pinned}
          sidebarPanelTab={sidebarPanelTab}
        />
      </SidePanel>
    </div>
  )
}
