/**
 * hisotry/bookmark/setting modal
 */

import { auto } from 'manate/react'
import { pick } from 'lodash-es'
import { Spin } from 'antd'
import { lazy, Suspense } from 'react'
import SettingModal from './setting-wrap'
import LazyBoundary from '../common/lazy-boundary'
import ResponsiveTabs from '../common/responsive-tabs'
import {
  settingMap,
  modals,
  settingPanelMobileBreakpoint
} from '../../common/constants'
const TabBookmarks = lazy(() => import('./tab-bookmarks'))
const TabSettings = lazy(() => import('./tab-settings'))
const TabProfiles = lazy(() => import('./tab-profiles'))

const Loading = () => <div style={{ padding: 20, textAlign: 'center' }}><Spin /></div>

const e = window.translate

export default auto(function SettingModalWrap (props) {
  const selectItem = (item) => {
    window.store.setSettingItem(item)
    // narrow panels drill into the right col content after picking a menu
    // item — same 800px breakpoint as the setting panel media query
    if (window.store.innerWidth <= settingPanelMobileBreakpoint) {
      window.store.settingMobileView = 'content'
    }
  }

  function renderTabs () {
    const { store } = props
    const tabsShouldConfirmDel = [
      settingMap.bookmarks,
      settingMap.terminalThemes
    ]
    const { settingTab, settingItem, bookmarkSelectMode } = store
    // settingSidebarList deep-copies the whole collection; the bookmarks tab
    // ignores `list` (it renders from treeProps), so skip it there — with
    // thousands of bookmarks that copy is the most expensive part of the render
    const list = settingTab === settingMap.bookmarks
      ? []
      : store.settingSidebarList
    const props0 = {
      store,
      activeItemId: settingItem.id,
      type: settingTab,
      onClickItem: selectItem,
      shouldConfirmDel: tabsShouldConfirmDel.includes(settingTab),
      list
    }
    const { bookmarks, bookmarkGroups, widgetInstances } = store
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
      widgetInstancesLength: widgetInstances.length,
      serials: store.serials,
      loaddingSerials: store.loaddingSerials
    }
    const treeProps = {
      ...props0,
      bookmarkSelectMode,
      bookmarkGroups,
      bookmarkGroupTree: store.bookmarkGroupTree,
      bookmarksMap: store.bookmarksMap,
      bookmarks,
      ...pick(store, [
        'currentBookmarkGroupId',
        'config',
        'checkedKeys',
        'expandedKeys',
        'leftSidePanelWidth',
        'initLoadingData'
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
      destroyOnHidden: true,
      className: 'setting-tabs',
      type: 'card',
      // the panel turns into a phone style drill-down at 800px (same
      // breakpoint as the media query in setting-wrap.styl), collapse the tab
      // bar there too instead of letting antd hide the overflow tabs
      isMobile: store.innerWidth <= settingPanelMobileBreakpoint
    }
    return (
      <>
        <ResponsiveTabs
          {...tabsProps}
        />
        <LazyBoundary>
          <Suspense fallback={<Loading />}>
            {settingTab === settingMap.bookmarks && (
              <TabBookmarks treeProps={treeProps} settingItem={settingItem} formProps={formProps} settingTab={settingTab} />
            )}
            {settingTab === settingMap.setting && (
              <TabSettings listProps={props0} settingItem={settingItem} settingTab={settingTab} store={store} />
            )}
            {settingTab === settingMap.profiles && (
              <TabProfiles listProps={props0} settingItem={settingItem} formProps={formProps} store={store} settingTab={settingTab} />
            )}
          </Suspense>
        </LazyBoundary>
      </>
    )
  }

  const {
    showModal,
    hideSettingModal
  } = props.store
  const show = showModal === modals.setting
  if (!show) {
    return null
  }
  return (
    <SettingModal
      onCancel={hideSettingModal}
      visible={show}
    >
      {renderTabs()}
    </SettingModal>
  )
})
