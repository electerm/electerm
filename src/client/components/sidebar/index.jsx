/**
 * sidebar
 */
import {memo} from 'react'
import {
  Icon, Tooltip
} from 'antd'
import BookMarksWrap from './bookmark'
import HistoryWrap from './history'
import TransferHistoryModal from './transfer-history-modal'
import MenuBtn from './menu-btn'
import {sidebarWidth} from '../../common/constants'
import './sidebar.styl'

const {prefix} = window
const e = prefix('control')
const c = prefix('common')
const m = prefix('menu')
const h = prefix('transferHistory')
const t = prefix('terminalThemes')
const u = prefix('updater')

export default memo((props) => {
  let {
    openedSideBar,
    onNewSsh,
    modifier,
    openSetting,
    transferHistory,
    openTransferHistory,
    openAbout,
    height,
    openTerminalThemes,
    upgradeInfo
  } = props
  let {showUpgradeModal, upgradePercent, checkingRemoteVersion, shouldUpgrade} = upgradeInfo
  let handler
  let interval = 400
  let setOpenedSideBar = (bar) => {
    return modifier({
      openedSideBar: bar
    })
  }
  let onMouseLeave = () => {
    handler = setTimeout(
      () => setOpenedSideBar(''),
      interval
    )
  }
  let onMouseEnterBookmark = () => {
    clearTimeout(handler)
    setOpenedSideBar('bookmarks')
  }
  let onMouseEnterHistory = () => {
    clearTimeout(handler)
    setOpenedSideBar('history')
  }
  let listStyle = {
    maxHeight: height - 160
  }
  let showUpgrade = () => {
    modifier(old => {
      return {
        upgradeInfo: {
          ...old.upgradeInfo,
          showUpgradeModal: true
        }
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
        {...props}
      />
      <div className="sidebar-bar btns">
        <div className="control-icon-wrap">
          <MenuBtn {...props} />
        </div>
        <div
          className="control-icon-wrap"
          onClick={onNewSsh}
          title={e('newSsh')}
        >
          <Icon
            className="font22 pointer iblock control-icon"
            type="plus-circle"
          />
        </div>
        <div
          className="control-icon-wrap"
          onMouseEnter={onMouseEnterBookmark}
          onMouseLeave={onMouseLeave}
          title={c('bookmarks')}
        >
          <Icon
            className="font20 pointer iblock control-icon"
            type="book"
          />
        </div>
        <div
          className="control-icon-wrap"
          onMouseEnter={onMouseEnterHistory}
          onMouseLeave={onMouseLeave}
          title={c('history')}
        >
          <Icon
            className="font20 pointer iblock control-icon"
            type="clock-circle"
          />
        </div>
        <div
          className="control-icon-wrap"
          onClick={openTerminalThemes}
          title={t('terminalThemes')}
        >
          <Icon
            type="picture"
            className="font20 iblock pointer control-icon"
          />
        </div>
        <div
          className="control-icon-wrap"
          onClick={openSetting}
          title={c('setting')}
        >
          <Icon
            className="iblock pointer font20 control-icon"
            type="setting"
          />
        </div>
        {
          transferHistory.length
            ? (
              <div
                className="control-icon-wrap"
                onClick={openTransferHistory}
                title={h('transferHistory')}
              >
                <Icon
                  className="font20 pointer iblock control-icon"
                  type="swap"
                />
              </div>
            )
            : null
        }
        <div
          className="control-icon-wrap"
          title={m('about')}
          onClick={openAbout}
        >
          <Icon
            className="iblock pointer font16 control-icon open-about-icon"
            type="info-circle-o"
          />
        </div>
        {
          !checkingRemoteVersion && !showUpgradeModal && shouldUpgrade
            ? (
              <Tooltip
                title={`${u('upgrading')} ${upgradePercent || 0}%`}
                placement="right"
              >
                <div
                  className="control-icon-wrap"
                  onClick={showUpgrade}
                >
                  <Icon
                    className="iblock pointer font18 control-icon hvr-bob upgrade-icon"
                    type="up-circle"
                  />
                </div>
              </Tooltip>
            )
            : null
        }
      </div>
      <div
        className="sidebar-list"
      >
        <BookMarksWrap
          {...props}
          onMouseEnter={onMouseEnterBookmark}
          onMouseLeave={onMouseLeave}
          listStyle={listStyle}
        />
        <HistoryWrap
          {...props}
          onMouseEnter={onMouseEnterHistory}
          onMouseLeave={onMouseLeave}
          listStyle={listStyle}
        />
      </div>
    </div>
  )
})
