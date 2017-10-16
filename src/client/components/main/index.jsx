
import React from 'react'
import Wrapper from './window-wrapper'
import Control from '../control'
import {generate} from 'shortid'
import _ from 'lodash'
import copy from 'json-deep-copy'
import classnames from 'classnames'
import * as ls from '../../common/ls'
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
      config: getGlobal('_config') || {}
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

  onError = e => {
    console.log(e.stack)
    notification.error({
      message: 'error',
      description: e.stack
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
    this.editItem(id, update, 'type', this.setState)
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
    let {tabs, currentTabId} = this.state
    let controlProps = {
      ...this.state,
      ..._.pick(this, [
        'modifier', 'delTab', 'addTab', 'editTab',
        'onError',
        'modifyLs', 'addItem', 'editItem', 'delItem'
      ])
    }
    return (
      <div>
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
    )
  }

}
