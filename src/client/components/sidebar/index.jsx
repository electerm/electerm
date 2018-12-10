/**
 * sidebar
 */
import {memo} from 'react'
import {
  Icon
} from 'antd'
import BookMarksWrap from './bookmark'
import HistoryWrap from './history'
import TransferHistoryModal from './transfer-history-modal'
import {sidebarWidth} from '../../common'
import './sidebar.styl'

const {prefix} = window
const e = prefix('control')
const c = prefix('common')
const m = prefix('menu')
const h = prefix('transferHistory')
const t = prefix('terminalThemes')

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
    openTerminalThemes
  } = props
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
        <Icon
          className="font22 pointer iblock control-icon"
          type="plus-circle"
          onClick={onNewSsh}
          title={e('newSsh')}
        />
        <Icon
          className="font20 pointer iblock control-icon"
          type="book"
          onClick={() => modifier({
            openedSideBar: 'bookmarks'
          })}
          title={c('bookmarks')}
        />
        <Icon
          className="font20 pointer iblock control-icon"
          type="clock-circle"
          onClick={() => modifier({
            openedSideBar: 'history'
          })}
          title={c('history')}
        />
        <Icon
          type="picture"
          className="font20 iblock pointer control-icon"
          onClick={openTerminalThemes}
          title={t('terminalThemes')}
        />
        <Icon
          className="iblock pointer font20 control-icon"
          type="setting"
          onClick={openSetting}
          title={c('setting')}
        />
        {
          transferHistory.length
            ? (
              <Icon
                className="font20 pointer iblock control-icon"
                type="swap"
                onClick={openTransferHistory}
                title={h('transferHistory')}
              />
            )
            : null
        }
        <Icon
          type="info-circle-o"
          title={m('about')}
          className="iblock pointer font16 control-icon open-about-icon"
          onClick={openAbout}
        />
      </div>
      <div className="sidebar-list">
        <BookMarksWrap {...props} />
        <HistoryWrap {...props} />
      </div>
    </div>
  )
})
