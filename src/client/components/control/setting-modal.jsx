/**
 * hisotry/bookmark/setting modal
 */
import React from 'react'
import {Modal, Tabs, Col, Row} from 'antd'
import TerminalThemeForm from '../terminal-theme'
import TerminalThemeList from '../terminal-theme/theme-list'
import BookmarkForm from '../bookmark-form'
import List from './list'
import TreeList from './tree-list'
import Setting from '../setting'
import {settingMap} from '../../common/constants'

const {prefix} = window
const e = prefix('setting')
const m = prefix('common')
const t = prefix('terminalThemes')
const {TabPane} = Tabs

export default class SettingModal extends React.Component {

  constructor(props) {
    super(props)
    this.state = {
      visible: false
    }
  }

  show = () => {
    this.setState({
      visible: true
    })
  }

  hide = () => {
    this.setState({
      visible: false
    })
  }

  selectItem = (item) => {
    this.props.modifier2({item})
  }

  tabsShouldConfirmDel = [
    settingMap.bookmarks,
    settingMap.terminalThemes
  ]

  renderTabs() {
    let {tab, item, list} = this.props
    let props = {
      ...this.props,
      activeItemId: item.id,
      type: tab,
      onClickItem: this.selectItem,
      shouldComfirmDel: this.tabsShouldConfirmDel.includes(tab),
      list
    }
    let formProps = {
      ...this.props,
      formData: item,
      type: tab,
      hide: this.hide
    }
    return (
      <Tabs
        activeKey={tab}
        animated={false}
        onChange={this.props.onChangeTab}
      >
        <TabPane
          tab={m(settingMap.history)}
          key={settingMap.history}
        >
          <Row>
            <Col span={6}>
              <List
                {...props}
              />
            </Col>
            <Col span={18}>
              {
                item.id
                  ? (
                    <BookmarkForm
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
                {...props}
              />
            </Col>
            <Col span={14}>
              <BookmarkForm
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
                {...props}
              />
            </Col>
            <Col span={18}>
              <Setting {...this.props} />
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
                {...props}
              />
            </Col>
            <Col span={18}>
              <TerminalThemeForm {...formProps} />
            </Col>
          </Row>
        </TabPane>
      </Tabs>
    )
  }

  render() {
    let props = {
      title: e('settings'),
      onCancel: this.hide,
      footer: null,
      width: '94%',
      height: '94%',
      visible: this.state.visible
    }
    return (
      <Modal
        {...props}
      >
        {this.renderTabs()}
      </Modal>
    )
  }

}

