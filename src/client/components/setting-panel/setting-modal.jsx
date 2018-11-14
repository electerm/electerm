/**
 * hisotry/bookmark/setting modal
 */

import {Component} from '../common/react-subx'
import {Modal, Tabs, Col, Row} from 'antd'
import TerminalThemeForm from '../terminal-theme'
import TerminalThemeList from '../terminal-theme/theme-list'
import BookmarkForm from '../bookmark-form'
import List from './list'
import TreeList from './tree-list'
import Setting from './setting'
import {settingMap} from '../../common/constants'

const {prefix} = window
const e = prefix('setting')
const m = prefix('common')
const t = prefix('terminalThemes')
const {TabPane} = Tabs

export default class SettingModal extends Component {
  render() {
    let {props} = this
    let {setState, hideModal, onChangeTab, showModal} = props.store
    const selectItem = (item) => {
      setState({item})
    }

    const tabsShouldConfirmDel = [
      settingMap.bookmarks,
      settingMap.terminalThemes
    ]

    const renderTabs = () => {
      let {tab, item, getItemList} = props.store
      let list = getItemList()
      let props0 = {
        ...props,
        activeItemId: item.id,
        type: tab,
        onClickItem: selectItem,
        shouldComfirmDel: tabsShouldConfirmDel.includes(tab),
        list
      }
      let formProps = {
        ...props,
        formData: item,
        type: tab,
        hide: hideModal
      }
      return (
        <Tabs
          activeKey={tab}
          animated={false}
          onChange={onChangeTab}
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
                    : <div className="form-wrap pd2 aligncenter">c('notFoundContent')</div>
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
                <Setting {...props0} />
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
          onCancel: hideModal,
          footer: null,
          width: '94%',
          height: '94%',
          visible: showModal
        }}
      >
        {renderTabs()}
      </Modal>
    )
  }
}
