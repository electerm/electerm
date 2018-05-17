/**
 * hisotry/bookmark/setting modal
 */
import React from 'react'
import {Modal, Tabs, Col, Row} from 'antd'
import TerminalThemeForm from '../terminal-theme'
import TerminalThemeList from '../terminal-theme/theme-list'
import SshForm from '../ssh-form'
import List from './list'
import _ from 'lodash'
import Setting from '../setting'
import copy from 'json-deep-copy'
import {settingMap, defaultTheme} from '../../common/constants'
import {buildNewTheme} from '../../common/terminal-theme'

const {prefix} = window
const e = prefix('setting')
const m = prefix('common')
const props = ['item']
const {TabPane} = Tabs
const getInitItem = (arr, tab) => {
  if (tab === settingMap.history) {
    return arr[0] || {}
  } else if (tab === settingMap.bookmarks) {
    return {id: ''}
  } else if (tab === settingMap.setting) {
    return {id: ''}
  } else if (tab === settingMap.terminalThemes) {
    return buildNewTheme()
  }
}

export default class SettingModal extends React.Component {

  constructor(props) {
    super(props)
    let {tab} = props
    this.state = {
      visible: false,
      item: props.item || getInitItem(
        this.getItems(tab, props),
        props.tab
      )
    }
  }

  // componentWillReceiveProps(nextProps) {
  //   let oldProps = _.pick(this.state, props)
  //   let newProps = _.pick(nextProps, props)
  //   if (!_.isEqual(oldProps, newProps)) {
  //     this.setState(copy(newProps))
  //   }
  // }

  getItems = (tab, props = this.props) => {
    return tab === settingMap.terminalThemes
      ? copy(props.themes)
      : copy(props[tab]) || []
  }

  onChangeTab = tab => {
    let arr = this.getItems(tab)
    let item = getInitItem(arr, tab)
    this.setState({
      item
    })
    this.props.onChangeTab(tab)
  }

  show = () => {
    this.setState({
      visible: true
    })
  }

  hide = () => {
    this.setState({
      visible: false,
      tab: ''
    })
  }

  selectItem = (item, type) => {
    let oldItem = this.state.item
    let oldType = this.state.type
    if (oldItem.id === item.id && oldType === type) {
      return
    }
    this.setState({item, type})
  }

  renderTabs() {
    let {
      item
    } = this.state
    let {tab} = this.props
    let list = this.getItems(tab)
    if (tab === settingMap.bookmarks) {
      list.unshift({
        title: e('new'),
        id: ''
      })
    } else if (tab === settingMap.setting) {
      list.unshift({
        title: e('common'),
        id: ''
      })
    } else if (tab === settingMap.terminalThemes) {
      let newTheme = copy(defaultTheme)
      newTheme.name = 'new theme'
      newTheme.id = ''
      list = [
        newTheme,
        ...this.props.themes
      ]
    }
    let props = {
      ...this.props,
      activeItemId: item.id,
      type: tab,
      onClickItem: this.selectItem,
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
        onChange={this.onChangeTab}
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
                    <SshForm
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
            <Col span={6}>
              <List
                {...props}
              />
            </Col>
            <Col span={18}>
              <SshForm
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
          tab={m(settingMap.terminalThemes)}
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

