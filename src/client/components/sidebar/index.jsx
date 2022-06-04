import {
  BookOutlined,
  ClockCircleOutlined,
  CloudSyncOutlined,
  InfoCircleOutlined,
  PictureOutlined,
  PlusCircleOutlined,
  SettingOutlined,
  UpCircleOutlined
} from '@ant-design/icons'

import { Tooltip } from 'antd'
import { Component } from '../common/react-subx'
import BookMarksWrap from './bookmark'
import HistoryWrap from './history'
import TransferList from './transfer-list'
import MenuBtn from '../context-menu/menu-btn'
import InfoModal from './info-modal'
import { sidebarWidth } from '../../common/constants'
import './sidebar.styl'

const { prefix } = window
const e = prefix('control')
const c = prefix('common')
const m = prefix('menu')
const t = prefix('terminalThemes')
const u = prefix('updater')
const ss = prefix('settingSync')

export default class Sidebar extends Component {
  handler = null

  onMouseLeave = () => {
    if (this.props.store.pinned) {
      return false
    }
    const interval = 400
    this.handler = setTimeout(
      () => this.props.store.setOpenedSideBar(''),
      interval
    )
  }

  onMouseEnterBookmark = () => {
    if (this.props.store.pinned) {
      return false
    }
    clearTimeout(this.handler)
    this.props.store.setOpenedSideBar('bookmarks')
  }

  onMouseEnterHistory = () => {
    if (this.props.store.pinned) {
      return false
    }
    clearTimeout(this.handler)
    this.props.store.setOpenedSideBar('history')
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
      openAbout,
      openSettingSync,
      height,
      openTerminalThemes,
      upgradeInfo,
      onClickBookmark,
      onClickHistory
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
        <div className='sidebar-bar btns'>
          <div className='control-icon-wrap'>
            <MenuBtn store={store} />
          </div>
          <div
            className='control-icon-wrap'
            title={e('newBookmark')}
          >
            <PlusCircleOutlined
              className='font22 iblock control-icon'
              onClick={onNewSsh}
            />
          </div>
          <div
            className='control-icon-wrap'
            title={c('bookmarks')}
          >
            <BookOutlined
              onMouseEnter={this.onMouseEnterBookmark}
              onMouseLeave={this.onMouseLeave}
              onClick={onClickBookmark}
              className='font20 iblock control-icon' />
          </div>
          <div
            className='control-icon-wrap'
            title={c('history')}
          >
            <ClockCircleOutlined
              onMouseEnter={this.onMouseEnterHistory}
              onMouseLeave={this.onMouseLeave}
              onClick={onClickHistory}
              className='font20 iblock control-icon' />
          </div>
          <TransferList store={store} />
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
