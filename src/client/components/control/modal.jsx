/**
 * hisotry/bookmark/setting modal
 */
import React from 'react'
import {Modal, Tabs, Col, Row} from 'antd'
import SshForm from '../ssh-form'
import List from './list'
import _ from 'lodash'
import Setting from '../setting'
import copy from 'json-deep-copy'
import {settingMap} from '../../common/constants'

const props = ['tab', 'item']
const {TabPane} = Tabs
const getInitItem = (arr, tab) => {
  if (tab === 'history') {
    return arr[0] || {}
  } else if (tab === 'bookmarks') {
    return {id: ''}
  } else if (tab === 'setting') {
    return {id: ''}
  }
}

export default class SettingModal extends React.Component {

  constructor(props) {
    super(props)
    this.state = {
      visible: false,
      tab: props.type || settingMap.bookmarks,
      item: props.item || {
        id: ''
      }
    }
  }

  componentWillReceiveProps(nextProps) {
    let oldProps = _.pick(this.state, props)
    let newProps = _.pick(nextProps, props)
    if (!_.isEqual(oldProps, newProps)) {
      this.setState(copy(newProps))
    }
  }

  onChangeTab = tab => {
    let arr = this.props[tab] || []
    let item = getInitItem(arr, tab)
    this.setState({
      tab,
      item
    })
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
      tab,
      item
    } = this.state
    let list = copy(this.props[tab]) || []
    if (tab === settingMap.bookmarks) {
      list.unshift({
        title: 'new',
        id: ''
      })
    } else if (tab === settingMap.setting) {
      list.unshift({
        title: 'common',
        id: ''
      })
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
          tab={settingMap.history}
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
                  : <div className="form-wrap pd2 aligncenter">no history</div>
              }

            </Col>
          </Row>
        </TabPane>
        <TabPane
          tab={settingMap.bookmarks}
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
          tab={settingMap.setting}
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
      </Tabs>
    )
  }

  render() {
    let props = {
      title: 'settings',
      onCancel: this.hide,
      footer: null,
      width: 800,
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

