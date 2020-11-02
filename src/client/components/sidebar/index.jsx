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
  render () {
    const { store } = this.props
    const {
      openedSideBar,
      onNewSsh,
      storeAssign,
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
    let handler
    const interval = 400
    const setOpenedSideBar = (bar) => {
      return storeAssign({
        openedSideBar: bar
      })
    }
    const onMouseLeave = () => {
      handler = setTimeout(
        () => setOpenedSideBar(''),
        interval
      )
    }
    const onMouseEnterBookmark = () => {
      clearTimeout(handler)
      setOpenedSideBar('bookmarks')
    }
    const onMouseEnterHistory = () => {
      clearTimeout(handler)
      setOpenedSideBar('history')
    }
    const listStyle = {
      maxHeight: height - 160
    }
    const showUpgrade = () => {
      storeAssign({
        upgradeInfo: {
          ...store.upgradeInfo,
          showUpgradeModal: true
        }
      })
    }
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
              onMouseEnter={onMouseEnterBookmark}
              onMouseLeave={onMouseLeave}
              className='font20 iblock control-icon' />
          </div>
          <div
            className='control-icon-wrap'
            title={c('history')}
          >
            <ClockCircleOutlined
              onMouseEnter={onMouseEnterHistory}
              onMouseLeave={onMouseLeave}
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
                      onClick={showUpgrade} />
                  </div>
                </Tooltip>
              )
              : null
          }
        </div>
        <div
          className='sidebar-list'
        >
          <BookMarksWrap
            store={store}
            onMouseEnter={onMouseEnterBookmark}
            onMouseLeave={onMouseLeave}
            listStyle={listStyle}
          />
          <HistoryWrap
            store={store}
            onMouseEnter={onMouseEnterHistory}
            onMouseLeave={onMouseLeave}
            listStyle={listStyle}
          />
        </div>
      </div>
    )
  }
}
