/**
 * hisotry/bookmark/setting modal
 */

import { auto } from 'manate/react'
import { pick } from 'lodash-es'
import { Tabs } from 'antd'
import SettingModal from './setting-wrap'
import {
  settingMap,
  modals
} from '../../common/constants'
import TabBookmarks from './tab-bookmarks'
import TabQuickCommands from './tab-quick-commands'
import TabSettings from './tab-settings'
import TabThemes from './tab-themes'
import TabProfiles from './tab-profiles'

const e = window.translate

export default auto(function SettingModalWrap (props) {
  const selectItem = (item) => {
    window.store.setSettingItem(item)
  }

  function renderTabs () {
    const { store } = props
    const tabsShouldConfirmDel = [
      settingMap.bookmarks,
      settingMap.terminalThemes
    ]
    const { settingTab, settingItem, settingSidebarList, bookmarkSelectMode } = store
    const props0 = {
      store,
      activeItemId: settingItem.id,
      type: settingTab,
      onClickItem: selectItem,
      shouldConfirmDel: tabsShouldConfirmDel.includes(settingTab),
      list: settingSidebarList
    }
    const { bookmarks, bookmarkGroups } = store
    const formProps = {
      store,
      formData: settingItem,
      type: settingTab,
      hide: store.hideSettingModal,
      ...pick(store, [
        'currentBookmarkGroupId',
        'config'
      ]),
      bookmarkGroups,
      bookmarks,
      serials: store.serials,
      loaddingSerials: store.loaddingSerials
    }
    const treeProps = {
      ...props0,
      bookmarkSelectMode,
      bookmarkGroups,
      bookmarksMap: store.bookmarksMap,
      bookmarks,
      ...pick(store, [
        'currentBookmarkGroupId',
        'config',
        'checkedKeys',
        'expandedKeys',
        'leftSidebarWidth'
      ])
    }
    const items = [
      {
        key: settingMap.bookmarks,
        label: e(settingMap.bookmarks),
        children: null
      },
      {
        key: settingMap.setting,
        label: e(settingMap.setting),
        children: null
      },
      {
        key: settingMap.terminalThemes,
        label: e('uiThemes'),
        children: null
      },
      {
        key: settingMap.quickCommands,
        label: e(settingMap.quickCommands),
        children: null
      },
      {
        key: settingMap.profiles,
        label: e(settingMap.profiles),
        children: null
      }
    ]
    const tabsProps = {
      activeKey: settingTab,
      animated: false,
      items,
      onChange: store.handleChangeSettingTab,
      destroyInactiveTabPane: true,
      className: 'setting-tabs',
      type: 'card'
    }
    return (
      <div>
        <Tabs
          {...tabsProps}
        />
        <TabQuickCommands
          listProps={props0}
          settingItem={settingItem}
          formProps={formProps}
          store={store}
          settingTab={settingTab}
        />
        <TabBookmarks
          treeProps={treeProps}
          settingItem={settingItem}
          formProps={formProps}
          settingTab={settingTab}
        />
        <TabSettings
          listProps={props0}
          settingItem={settingItem}
          settingTab={settingTab}
          store={store}
        />
        <TabThemes
          listProps={props0}
          settingItem={settingItem}
          formProps={formProps}
          store={store}
          settingTab={settingTab}
        />
        <TabProfiles
          listProps={props0}
          settingItem={settingItem}
          formProps={formProps}
          store={store}
          settingTab={settingTab}
        />
      </div>
    )
  }

  const {
    showModal,
    hideSettingModal,
    innerWidth,
    useSystemTitleBar
  } = props.store
  const show = showModal === modals.setting
  if (!show) {
    return null
  }
  return (
    <SettingModal
      onCancel={hideSettingModal}
      visible={show}
      useSystemTitleBar={useSystemTitleBar}
      innerWidth={innerWidth}
    >
      {renderTabs()}
    </SettingModal>
  )
})
