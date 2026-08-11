/**
 * renders the customizable far-left sidebar icons.
 *
 * which icons appear, and in what order, is driven by `iconIds`
 * (from config.leftSideBarIcons). The "about" and "hide sidebar" icons are
 * not customizable and stay rendered by the parent (sidebar/index.jsx).
 */

import {
  AppstoreOutlined,
  BookOutlined,
  CloudSyncOutlined,
  PictureOutlined,
  PlusCircleOutlined,
  SettingOutlined,
  ThunderboltOutlined
} from '@ant-design/icons'
import { Popover } from 'antd'
import SideIcon from './side-icon'
import TransferList from './transfer-list'
import QuickConnect from '../tabs/quick-connect'
import { settingMap } from '../../common/constants'
import { defaultLeftSideBarIcons } from '../../common/left-sidebar-icon-defs'

const e = window.translate

export default function LeftSidebarIcons (props) {
  const {
    iconIds,
    handleClickBookmark,
    onNewSsh,
    openSetting,
    openSettingSync,
    openTerminalThemes,
    openWidgetsModal,
    bookmarksActive,
    themeActive,
    settingActive,
    syncActive,
    widgetsActive,
    isSyncingSetting,
    transferProps
  } = props

  const ids = Array.isArray(iconIds) && iconIds.length
    ? iconIds
    : defaultLeftSideBarIcons

  const registry = {
    newBookmark: (
      <SideIcon
        key='newBookmark'
        title={e('newBookmark')}
      >
        <PlusCircleOutlined
          className='font22 iblock control-icon'
          onClick={onNewSsh}
        />
      </SideIcon>
    ),
    quickConnect: (
      <Popover
        key='quickConnect'
        content={<QuickConnect inputOnly />}
        trigger='click'
        placement='right'
      >
        <div
          className='control-icon-wrap'
          title={e('quickConnect')}
        >
          <ThunderboltOutlined className='font20 iblock control-icon' />
        </div>
      </Popover>
    ),
    bookmarks: (
      <SideIcon
        key='bookmarks'
        title={e(settingMap.bookmarks)}
        active={bookmarksActive}
      >
        <BookOutlined
          onClick={handleClickBookmark}
          className='font20 iblock control-icon'
        />
      </SideIcon>
    ),
    transferList: (
      <TransferList
        key='transferList'
        {...transferProps}
      />
    ),
    terminalThemes: (
      <SideIcon
        key='terminalThemes'
        title={e(settingMap.terminalThemes)}
        active={themeActive}
      >
        <PictureOutlined
          className='font20 iblock pointer control-icon'
          onClick={openTerminalThemes}
        />
      </SideIcon>
    ),
    setting: (
      <SideIcon
        key='setting'
        title={e(settingMap.setting)}
        active={settingActive}
      >
        <SettingOutlined
          className='iblock font20 control-icon'
          onClick={openSetting}
        />
      </SideIcon>
    ),
    settingSync: (
      <SideIcon
        key='settingSync'
        title={e('settingSync')}
        active={syncActive}
      >
        <CloudSyncOutlined
          className='iblock font20 control-icon'
          onClick={openSettingSync}
          spin={isSyncingSetting}
        />
      </SideIcon>
    ),
    widgets: (
      <SideIcon
        key='widgets'
        title={e('widgets')}
        active={widgetsActive}
      >
        <AppstoreOutlined
          className='iblock font20 control-icon'
          onClick={openWidgetsModal}
        />
      </SideIcon>
    )
  }

  return ids.map(id => registry[id] || null)
}
