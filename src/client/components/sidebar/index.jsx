import {
  BookOutlined,
  ClockCircleOutlined,
  CloudSyncOutlined,
  InfoCircleOutlined,
  PictureOutlined,
  PlusCircleOutlined,
  SettingOutlined,
  SwapOutlined,
  UpCircleOutlined
} from '@ant-design/icons'

import { Tooltip } from 'antd'
import { Component } from '../common/react-subx'
import BookMarksWrap from './bookmark'
import HistoryWrap from './history'
import TransferHistoryModal from './transfer-history-modal'
import MenuBtn from './menu-btn'
import InfoModal from './info-modal'
import { sidebarWidth } from '../../common/constants'
import './sidebar.styl'

const { prefix } = window
const e = prefix('control')
const c = prefix('common')
const m = prefix('menu')
const h = prefix('transferHistory')
const t = prefix('terminalThemes')
const u = prefix('updater')
const ss = prefix('settingSync')

export default class Sidebar extends Component {
  handler = null

  setOpenedSideBar = (bar) => {
    const { store } = this.props
    const {
      storeAssign
    } = store
    return storeAssign({
      openedSideBar: bar
    })
  }

  onMouseLeave = () => {
    if (this.props.store.pinned) {
      return false
    }
    const interval = 400
    this.handler = setTimeout(
      () => this.setOpenedSideBar(''),
      interval
    )
  }

  onMouseEnterBookmark = () => {
    if (this.props.store.pinned) {
      return false
    }
    clearTimeout(this.handler)
    this.setOpenedSideBar('bookmarks')
  }

  onMouseEnterHistory = () => {
    if (this.props.store.pinned) {
      return false
    }
    clearTimeout(this.handler)
    this.setOpenedSideBar('history')
  }

  showUpgrade = () => {
    this.props.store.storeAssign({
      upgradeInfo: {
        ...this.props.store.upgradeInfo,
        showUpgradeModal: true
      }
    })
  }

  render () {
    const { store } = this.props
    const {
      openedSideBar,
      onNewSsh,
      openSetting,
      transferHistory,
      openTransferHistory,
      openAbout,
      openSettingSync,
      height,
      openTerminalThemes,
      upgradeInfo
    } = store
    const { showUpgradeModal, upgradePercent, checkingRemoteVersion, shouldUpgrade } = upgradeInfo
    return (
      <div
        className={`sidebar type-${openedSideBar}`}
        style={{
          width: sidebarWidth,
          height
        }}
      >
        <TransferHistoryModal
          store={store}
        />
        <div className='sidebar-bar btns'>
          <div className='control-icon-wrap'>
            <MenuBtn store={store} />
          </div>
          <div
            className='control-icon-wrap'
            title={e('newSsh')}
          >
            <PlusCircleOutlined className='font22 iblock control-icon' onClick={onNewSsh} />
          </div>
          <div
            className='control-icon-wrap'
            title={c('bookmarks')}
          >
            <BookOutlined
              onMouseEnter={this.onMouseEnterBookmark}
              onMouseLeave={this.onMouseLeave}
              className='font20 iblock control-icon' />
          </div>
          <div
            className='control-icon-wrap'
            title={c('history')}
          >
            <ClockCircleOutlined
              onMouseEnter={this.onMouseEnterHistory}
              onMouseLeave={this.onMouseLeave}
              className='font20 iblock control-icon' />
          </div>
          <div
            className='control-icon-wrap'
            title={t('terminalThemes')}
          >
            <PictureOutlined
              className='font20 iblock pointer control-icon'
              onClick={openTerminalThemes} />
          </div>
          <div
            className='control-icon-wrap'
            title={c('setting')}
          >
            <SettingOutlined className='iblock font20 control-icon' onClick={openSetting} />
          </div>
          <div
            className='control-icon-wrap'
            title={ss('settingSync')}
          >
            <CloudSyncOutlined className='iblock font20 control-icon' onClick={openSettingSync} />
          </div>
          {
            transferHistory.length
              ? (
                <div
                  className='control-icon-wrap'
                  title={h('transferHistory')}
                >
                  <SwapOutlined className='font20 iblock control-icon' onClick={openTransferHistory} />
                </div>
              )
              : null
          }
          <div
            className='control-icon-wrap'
            title={m('about')}
          >
            <InfoCircleOutlined
              className='iblock font16 control-icon open-about-icon'
              onClick={openAbout} />
          </div>
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
                      onClick={this.showUpgrade} />
                  </div>
                </Tooltip>
              )
              : null
          }
        </div>
        <InfoModal store={store} />
        <div
          className='sidebar-list'
        >
          <BookMarksWrap
            store={store}
            onMouseEnter={this.onMouseEnterBookmark}
            onMouseLeave={this.onMouseLeave}
          />
          <HistoryWrap
            store={store}
            onMouseEnter={this.onMouseEnterHistory}
            onMouseLeave={this.onMouseLeave}
          />
        </div>
      </div>
    )
  }
}
