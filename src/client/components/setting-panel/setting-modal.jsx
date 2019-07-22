/**
 * hisotry/bookmark/setting modal
 */

import { Component } from '../common/react-subx'
import _ from 'lodash'
import { Modal, Tabs, Col, Row } from 'antd'
import TerminalThemeForm from '../terminal-theme'
import TerminalThemeList from '../terminal-theme/theme-list'
import BookmarkForm from '../bookmark-form'
import List from './list'
import TreeList from './tree-list'
import Setting from './setting'
import { settingMap } from '../../common/constants'
import copy from 'json-deep-copy'

const { prefix } = window
const e = prefix('setting')
const m = prefix('common')
const c = prefix('control')
const t = prefix('terminalThemes')
const { TabPane } = Tabs

export default class SettingModal extends Component {
  render () {
    const { store } = this.props
    const selectItem = (item) => {
      store.modifier({ item })
    }

    const tabsShouldConfirmDel = [
      settingMap.bookmarks,
      settingMap.terminalThemes
    ]

    const renderTabs = () => {
      const { tab, item, list } = store
      const props0 = {
        store,
        activeItemId: item.id,
        type: tab,
        onClickItem: selectItem,
        shouldComfirmDel: tabsShouldConfirmDel.includes(tab),
        list
      }
      const formProps = {
        store,
        formData: item,
        type: tab,
        hide: store.hideModal,
        ..._.pick(store, [
          'currentBookmarkGroupId',
          'config'
        ]),
        bookmarkGroups: copy(store.bookmarkGroups),
        bookmarks: copy(store.bookmarks)
      }
      return (
        <Tabs
          activeKey={tab}
          animated={false}
          onChange={store.onChangeTab}
        >
          <TabPane
            tab={m(settingMap.history)}
            key={settingMap.history}
          >
            <Row>
              <Col span={6}>
                <List
                  {...props0}
                />
              </Col>
              <Col span={18}>
                {
                  item.id
                    ? (
                      <BookmarkForm
                        key={item.id}
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
          >
            <Row>
              <Col span={10}>
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
              </Col>
              <Col span={14}>
                <BookmarkForm
                  key={item.id}
                  {...formProps}
                />
              </Col>
            </Row>
          </TabPane>
          <TabPane
            tab={m(settingMap.setting)}
            key={settingMap.setting}
          >
            <Row>
              <Col span={6}>
                <List
                  {...props0}
                />
              </Col>
              <Col span={18}>
                <Setting {...props0} config={store.config} />
              </Col>
            </Row>
          </TabPane>
          <TabPane
            tab={t(settingMap.terminalThemes)}
            key={settingMap.terminalThemes}
          >
            <Row>
              <Col span={6}>
                <TerminalThemeList
                  {...props0}
                  theme={store.theme}
                />
              </Col>
              <Col span={18}>
                <TerminalThemeForm {...formProps} key={item.id} />
              </Col>
            </Row>
          </TabPane>
        </Tabs>
      )
    }

    return (
      <Modal
        {...{
          title: e('settings'),
          onCancel: store.hideModal,
          footer: null,
          width: '94%',
          height: '94%',
          visible: store.showModal
        }}
      >
        {renderTabs()}
      </Modal>
    )
  }
}
