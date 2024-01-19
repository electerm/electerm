/**
 * hisotry/bookmark/setting modal
 */

import { Component } from '../common/react-subx'
import { pick } from 'lodash-es'
import { Tabs } from 'antd'
import SettingModal from './setting-wrap'
import {
  settingMap,
  modals
} from '../../common/constants'
import TabBookmarks from './tab-bookmarks'
import TabHistory from './tab-history'
import TabQuickCommands from './tab-quick-commands'
import TabSettings from './tab-settings'
import TabThemes from './tab-themes'

const { prefix } = window
const m = prefix('common')
const t = prefix('terminalThemes')
const q = prefix('quickCommands')

export default class SettingModalWrap extends Component {
  selectItem = (item) => {
    const { store } = this.props
    store.setSettingItem(item)
  }

  renderTabs () {
    const { store } = this.props
    const tabsShouldConfirmDel = [
      settingMap.bookmarks,
      settingMap.terminalThemes
    ]
    const { settingTab, settingItem, settingSidebarList, bookmarkSelectMode } = store
    const props0 = {
      store,
      activeItemId: settingItem.id,
      type: settingTab,
      onClickItem: this.selectItem,
      shouldConfirmDel: tabsShouldConfirmDel.includes(settingTab),
      list: settingSidebarList
    }
    const formProps = {
      store,
      formData: settingItem,
      type: settingTab,
      hide: store.hideSettingModal,
      ...pick(store, [
        'currentBookmarkGroupId',
        'config'
      ]),
      bookmarkGroups: store.bookmarkGroups,
      bookmarks: store.bookmarks,
      serials: store.serials,
      loaddingSerials: store.loaddingSerials
    }
    const treeProps = {
      ...props0,
      bookmarkSelectMode,
      bookmarkGroups: store.bookmarkGroups,
      bookmarks: store.bookmarks,
      ...pick(store, [
        'currentBookmarkGroupId',
        'autofocustrigger',
        'config'
      ])
    }
    const items = [
      {
        key: settingMap.history,
        label: m(settingMap.history),
        children: null
      },
      {
        key: settingMap.bookmarks,
        label: m(settingMap.bookmarks),
        children: null
      },
      {
        key: settingMap.setting,
        label: m(settingMap.setting),
        children: null
      },
      {
        key: settingMap.terminalThemes,
        label: t('uiThemes'),
        children: null
      },
      {
        key: settingMap.quickCommands,
        label: q(settingMap.quickCommands),
        children: null
      }
    ]
    return (
      <div>
        <Tabs
          activeKey={settingTab}
          animated={false}
          items={items}
          onChange={store.handleChangeSettingTab}
          destroyInactiveTabPane
          className='setting-tabs'
        />
        <TabHistory
          listProps={props0}
          settingItem={settingItem}
          formProps={formProps}
          settingTab={settingTab}
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
      </div>
    )
  }

  render () {
    const {
      showModal,
      hideSettingModal,
      innerWidth,
      useSystemTitleBar
    } = this.props.store
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
        {this.renderTabs()}
      </SettingModal>
    )
  }
}
