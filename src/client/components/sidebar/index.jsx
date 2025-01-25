import {
  BookOutlined,
  CloudSyncOutlined,
  InfoCircleOutlined,
  PictureOutlined,
  PlusCircleOutlined,
  SettingOutlined,
  UpCircleOutlined,
  BarsOutlined
} from '@ant-design/icons'
import { useRef, memo } from 'react'
import { Tooltip } from 'antd'
import SideBarPanel from './sidebar-panel'
import TransferList from './transfer-list'
import MenuBtn from '../sys-menu/menu-btn'
import {
  sidebarWidth,
  settingMap,
  modals
} from '../../common/constants'
import SideIcon from './side-icon'
import SidePanel from './side-panel'
import './sidebar.styl'

const e = window.translate

export default memo(function Sidebar (props) {
  const handler = useRef(null)

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
    sidebarPanelTab
  } = props

  const { store } = window

  const handleMouseLeave = () => {
    if (pinned) {
      return false
    }
    handler.current = setTimeout(
      () => store.setOpenedSideBar(''),
      400
    )
  }

  const handleMouseEnterBookmark = () => {
    if (pinned) {
      return false
    }
    clearTimeout(handler.current)
    store.setOpenedSideBar('bookmarks')
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
    onClickBookmark,
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
          <PlusCircleOutlined
            className='font22 iblock control-icon'
            onClick={onNewSsh}
          />
        </SideIcon>
        <SideIcon
          title={e(settingMap.bookmarks)}
          active={bookmarksActive}
        >
          <BookOutlined
            onMouseEnter={handleMouseEnterBookmark}
            onMouseLeave={handleMouseLeave}
            onClick={onClickBookmark}
            className='font20 iblock control-icon'
          />
        </SideIcon>
        <TransferList {...transferProps} />
        <SideIcon
          title={e(settingMap.terminalThemes)}
          active={themeActive}
        >
          <PictureOutlined
            className='font20 iblock pointer control-icon'
            onClick={openTerminalThemes}
          />
        </SideIcon>
        <SideIcon
          title={e(settingMap.setting)}
          active={settingActive}
        >
          <SettingOutlined className='iblock font20 control-icon' onClick={openSetting} />
        </SideIcon>
        <SideIcon
          title={e('settingSync')}
          active={syncActive}
        >
          <CloudSyncOutlined
            className='iblock font20 control-icon'
            onClick={openSettingSync}
            spin={isSyncingSetting}
          />
        </SideIcon>
        <SideIcon
          title={e('batchOp')}
          active={showBatchOp}
        >
          <BarsOutlined className='iblock font20 control-icon' onClick={toggleBatchOp} />
        </SideIcon>
        <SideIcon
          title={e('about')}
          active={showInfoModal}
        >
          <InfoCircleOutlined
            className='iblock font16 control-icon open-about-icon'
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
                  <UpCircleOutlined
                    className='iblock font18 control-icon hvr-bob upgrade-icon'
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
          onMouseEnter={handleMouseEnterBookmark}
          onMouseLeave={handleMouseLeave}
        />
      </SidePanel>
    </div>
  )
})
