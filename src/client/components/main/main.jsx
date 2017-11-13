
import React from 'react'
import Wrapper from './window-wrapper'
import Control from '../control'
import {generate} from 'shortid'
import _ from 'lodash'
import copy from 'json-deep-copy'
import classnames from 'classnames'
import * as ls from '../../common/ls'
import ContextMenu from '../common/context-menu'
import {notification} from 'antd'

const initTabs = () => [
  {
    id: generate(),
    title: 'new terminal'
  }
]
const {getGlobal} = window

export default class Index extends React.Component {

  constructor(props) {
    super(props)
    let tabs = initTabs()
    this.state = {
      tabs,
      currentTabId: tabs[0].id,
      history: ls.get('history') || [],
      bookmarks: ls.get('bookmarks') || [],
      config: getGlobal('_config') || {},
      contextMenuProps: {},
      contextMenuVisible: false
    }
  }

  componentDidUpdate(prevProps, prevState) {
    let {currentTabId} = this.state
    if (
      prevState.currentTabId !== currentTabId &&
      currentTabId
    ) {
      let term = _.get(this, `term_${currentTabId}.term`)
      term && term.focus()
    }
  }

  setStateLs = (update) => {
    Object.keys(update).forEach(k => {
      ls.set(k, update[k])
    })
    this.setState(update)
  }

  modifyLs = (...args) => {
    this.setStateLs(...args)
  }

  modifier = (...args) => {
    this.setState(...args)
  }

  initEvent = () => {
    let dom = document.getElementById('outside-context')
    this.dom = dom
    dom.addEventListener('click', this.closeContextMenu)
  }

  openContextMenu = (contextMenuProps) => {
    this.setState({
      contextMenuProps,
      contextMenuVisible: true
    })
    this.initEvent()
  }

  closeContextMenu = () => {
    this.setState({
      contextMenuVisible: false
    })
    this.dom.removeEventListener('click', this.closeContextMenu)
  }

  onError = e => {
    let {message = 'error', stack} = e
    console.log(new Date + '', stack, _.isString(stack))
    let msg = (
      <div className="mw240 elli wordbreak" title={message}>
        {message}
      </div>
    )
    let description = (
      <pre
        className="mw300 elli common-err-desc wordbreak"
        title={stack}
      >
        {stack}
      </pre>
    )
    notification.error({
      message: msg,
      description,
      duration: 55
    })
  }

  addItem = (item, type) => {
    let items = copy(this.state[type])
    items.unshift(item)
    this.setStateLs({
      [type]: items
    })
  }

  editItem = (id, update, type, mod = this.setStateLs) => {
    let items = copy(this.state[type])
    let item = _.find(items, t => t.id === id)
    let index = _.findIndex(items, t => t.id === id)
    Object.assign(item, update)
    items.splice(index, 1, item)
    mod({
      [type]: items
    })
  }

  delItem = ({id}, type) => {
    let items = copy(this.state[type]).filter(t => {
      return t.id !== id
    })
    this.setStateLs({
      [type]: items
    })
  }

  addTab = tab => {
    let tabs = copy(this.state.tabs)
    tabs.push(tab)
    this.setState({
      tabs,
      currentTabId: tab.id
    })
  }

  editTab = (id, update) => {
    this.editItem(id, update, 'tabs', this.modifier)
  }

  delTab = ({id}) => {
    let tabs = copy(this.state.tabs).filter(t => {
      return t.id !== id
    })
    let {currentTabId} = this.state
    let update = {
      tabs
    }
    if (currentTabId === id) {
      let next = tabs[0] || {}
      update.currentTabId = next.id
    }
    this.setState(update)
  }

  render() {
    let {
      tabs,
      currentTabId,
      contextMenuProps,
      contextMenuVisible
    } = this.state
    let controlProps = {
      ...this.state,
      ..._.pick(this, [
        'modifier', 'delTab', 'addTab', 'editTab',
        'onError', 'openContextMenu', 'closeContextMenu',
        'modifyLs', 'addItem', 'editItem', 'delItem'
      ])
    }
    return (
      <div>
        <ContextMenu
          {...contextMenuProps}
          visible={contextMenuVisible}
        />
        <div id="outside-context">
          <Control
            {...controlProps}
          />
          <div className="ui-outer">
            {
              tabs.map((tab) => {
                let {id} = tab
                let cls = classnames({
                  hide: id !== currentTabId
                })
                return (
                  <div className={cls} key={id}>
                    <Wrapper
                      {...controlProps}
                      tab={tab}
                      ref={ref => this[`term_${id}`] = ref}
                    />
                  </div>
                )
              })
            }
          </div>
        </div>
      </div>
    )
  }

}
