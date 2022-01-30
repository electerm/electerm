/**
 * hisotry/bookmark/setting modal
 */

import { Component } from '../common/react-subx'
import _ from 'lodash'
import { Tabs, Col, Row } from 'antd'
import Modal from './setting-wrap'
import TerminalThemeForm from '../terminal-theme'
import TerminalThemeList from '../terminal-theme/theme-list'
import QuickCommandsList from '../quick-commands/quick-commands-list'
import QuickCommandsForm from '../quick-commands/quick-commands-form'
import BookmarkForm from '../bookmark-form'
import List from './list'
import TreeList from './tree-list'
import Setting from './setting'
import SettingCol from './col'
import SyncSetting from '../setting-sync/setting-sync'
import { settingMap, settingSyncId } from '../../common/constants'
import copy from 'json-deep-copy'

const { prefix } = window
const m = prefix('common')
const c = prefix('control')
const t = prefix('terminalThemes')
const q = prefix('quickCommands')
const { TabPane } = Tabs

export default class SettingModal extends Component {
  selectItem = (item) => {
    const { store } = this.props
    store.storeAssign({ settingItem: item })
  }

  renderTabs () {
    const { store } = this.props
    const tabsShouldConfirmDel = [
      settingMap.bookmarks,
      settingMap.terminalThemes
    ]
    const { tab, settingItem, settingSidebarList } = store
    const props0 = {
      store,
      activeItemId: settingItem.id,
      type: tab,
      onClickItem: this.selectItem,
      shouldConfirmDel: tabsShouldConfirmDel.includes(tab),
      list: settingSidebarList
    }
    const formProps = {
      store,
      formData: settingItem,
      type: tab,
      hide: store.hideModal,
      ..._.pick(store, [
        'currentBookmarkGroupId',
        'config'
      ]),
      bookmarkGroups: copy(store.bookmarkGroups),
      bookmarks: copy(store.bookmarks),
      serials: copy(store.serials),
      loaddingSerials: store.loaddingSerials
    }
    return (
      <Tabs
        activeKey={tab}
        animated={false}
        onChange={store.onChangeTab}
        className='setting-tabs'
      >
        <TabPane
          tab={m(settingMap.history)}
          key={settingMap.history}
          className='setting-tabs-history'
        >
          <Row>
            <Col span={6}>
              <List
                {...props0}
              />
            </Col>
            <Col span={18}>
              {
                settingItem.id
                  ? (
                    <BookmarkForm
                      key={settingItem.id}
                      {...formProps}
                    />
                  )
                  : <div className='form-wrap pd2 aligncenter'>{c('notFoundContent')}</div>
              }

            </Col>
          </Row>
        </TabPane>
        <TabPane
          tab={m(settingMap.bookmarks)}
          key={settingMap.bookmarks}
          className='setting-tabs-bookmarks'
        >
          <SettingCol>
            <div className='model-bookmark-tree-wrap'>
              <TreeList
                {...props0}
                {..._.pick(store, [
                  'bookmarkGroups',
                  'currentBookmarkGroupId',
                  'bookmarks',
                  'autofocustrigger',
                  'config'
                ])}
              />
            </div>
            <BookmarkForm
              key={settingItem.id}
              {...formProps}
            />
          </SettingCol>
        </TabPane>
        <TabPane
          tab={m(settingMap.setting)}
          key={settingMap.setting}
          className='setting-tabs-setting'
        >
          <SettingCol>
            <List
              {...props0}
            />
            {
              settingItem.id === settingSyncId
                ? (
                  <SyncSetting
                    store={store}
                    {...store.config.syncSetting}
                    {..._.pick(store, [
                      'autofocustrigger',
                      'isSyncingSetting',
                      'isSyncDownload',
                      'isSyncUpload',
                      'syncType'
                    ])}
                  />
                )
                : <Setting {...props0} config={store.config} />
            }
          </SettingCol>
        </TabPane>
        <TabPane
          tab={t('uiThemes')}
          key={settingMap.terminalThemes}
          className='setting-tabs-terminal-themes'
        >
          <SettingCol>
            <TerminalThemeList
              {...props0}
              theme={store.config.theme}
            />
            <TerminalThemeForm {...formProps} key={settingItem.id} />
          </SettingCol>
        </TabPane>
        <TabPane
          tab={q(settingMap.quickCommands)}
          key={settingMap.quickCommands}
          className='setting-tabs-quick-commands'
        >
          <SettingCol>
            <QuickCommandsList
              {...props0}
              quickCommandId={store.quickCommandId}
            />
            <QuickCommandsForm
              {...formProps}
              quickCommandTags={store.quickCommandTags}
              key={settingItem.id}
            />
          </SettingCol>
        </TabPane>
      </Tabs>
    )
  }

  render () {
    return (
      <Modal
        onCancel={this.props.store.hideModal}
        visible={this.props.store.showModal}
      >
        {this.renderTabs()}
      </Modal>
    )
  }
}
