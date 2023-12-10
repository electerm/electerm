import {
  BookOutlined,
  ClockCircleOutlined,
  CloudSyncOutlined,
  InfoCircleOutlined,
  PictureOutlined,
  PlusCircleOutlined,
  SettingOutlined,
  UpCircleOutlined,
  BarsOutlined
} from '@ant-design/icons'

import { Tooltip } from 'antd'
import { Component } from '../common/react-subx'
import BookMarksWrap from './bookmark'
import HistoryWrap from './history'
import TransferList from './transfer-list'
import MenuBtn from '../context-menu/menu-btn'
import InfoModal from './info-modal'
import {
  sidebarWidth,
  settingMap,
  modals
} from '../../common/constants'
import SideIcon from './side-icon'
import SidePanel from './side-panel'
import './sidebar.styl'

const { prefix } = window
const e = prefix('control')
const c = prefix('common')
const m = prefix('menu')
const t = prefix('terminalThemes')
const u = prefix('updater')
const ss = prefix('settingSync')
const b = prefix('batchOp')

export default class Sidebar extends Component {
  handler = null

  handleMouseLeave = () => {
    if (this.props.store.pinned) {
      return false
    }
    const interval = 400
    this.handler = setTimeout(
      () => this.props.store.setOpenedSideBar(''),
      interval
    )
  }

  handleMouseEnterBookmark = () => {
    if (this.props.store.pinned) {
      return false
    }
    clearTimeout(this.handler)
    this.props.store.setOpenedSideBar('bookmarks')
  }

  handleMouseEnterHistory = () => {
    if (this.props.store.pinned) {
      return false
    }
    clearTimeout(this.handler)
    this.props.store.setOpenedSideBar('history')
  }

  handleShowUpgrade = () => {
    this.props.store.storeAssign({
      _upgradeInfo: JSON.stringify({
        ...this.props.store.upgradeInfo,
        showUpgradeModal: true
      })
    })
  }

  render () {
    const { store } = this.props
    const {
      openedSideBar,
      onNewSsh,
      openSetting,
      openAbout,
      openSettingSync,
      height,
      openTerminalThemes,
      upgradeInfo,
      onClickBookmark,
      onClickHistory,
      toggleBatchOp,
      settingTab,
      showModal,
      showInfoModal,
      settingItem,
      isSyncingSetting,
      leftSidebarWidth,
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
    const historyActive = showSetting && settingTab === settingMap.history
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
    return (
      <div
        className={`sidebar type-${openedSideBar}`}
        style={{
          width: sidebarWidth,
          height
        }}
      >
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
            title={c(settingMap.bookmarks)}
            active={bookmarksActive}
          >
            <BookOutlined
              onMouseEnter={this.handleMouseEnterBookmark}
              onMouseLeave={this.handleMouseLeave}
              onClick={onClickBookmark}
              className='font20 iblock control-icon'
            />
          </SideIcon>
          <SideIcon
            title={c(settingMap.history)}
            active={historyActive}
          >
            <ClockCircleOutlined
              onMouseEnter={this.handleMouseEnterHistory}
              onMouseLeave={this.handleMouseLeave}
              onClick={onClickHistory}
              className='font20 iblock control-icon'
            />
          </SideIcon>
          <TransferList store={store} />
          <SideIcon
            title={t(settingMap.terminalThemes)}
            active={themeActive}
          >
            <PictureOutlined
              className='font20 iblock pointer control-icon'
              onClick={openTerminalThemes}
            />
          </SideIcon>
          <SideIcon
            title={c(settingMap.setting)}
            active={settingActive}
          >
            <SettingOutlined className='iblock font20 control-icon' onClick={openSetting} />
          </SideIcon>
          <SideIcon
            title={ss('settingSync')}
            active={syncActive}
          >
            <CloudSyncOutlined
              className='iblock font20 control-icon'
              onClick={openSettingSync}
              spin={isSyncingSetting}
            />
          </SideIcon>
          <SideIcon
            title={b('batchOp')}
            active={showBatchOp}
          >
            <BarsOutlined className='iblock font20 control-icon' onClick={toggleBatchOp} />
          </SideIcon>
          <SideIcon
            title={m('about')}
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
                  title={`${u('upgrading')} ${upgradePercent || 0}%`}
                  placement='right'
                >
                  <div
                    className='control-icon-wrap'
                  >
                    <UpCircleOutlined
                      className='iblock font18 control-icon hvr-bob upgrade-icon'
                      onClick={this.handleShowUpgrade}
                    />
                  </div>
                </Tooltip>
                )
              : null
          }
        </div>
        <InfoModal store={store} />
        <SidePanel
          sideProps={sideProps}
          setLeftSidePanelWidth={setLeftSidePanelWidth}
          leftSidebarWidth={leftSidebarWidth}
        >
          <BookMarksWrap
            store={store}
            onMouseEnter={this.handleMouseEnterBookmark}
            onMouseLeave={this.handleMouseLeave}
          />
          <HistoryWrap
            store={store}
            onMouseEnter={this.handleMouseEnterHistory}
            onMouseLeave={this.handleMouseLeave}
          />
        </SidePanel>
      </div>
    )
  }
}
