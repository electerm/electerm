/**
 * session tabs component
 * @param {array} props.tabs {id, title}
 */

import React from 'react'
import _ from 'lodash'
import {Icon, Dropdown, Menu} from 'antd'
import Tab from './tab'
import './tabs.styl'
import {tabWidth, tabMargin} from '../../common/constants'
import createName from '../../common/create-title'
import WindowControl from './window-control'

const {prefix} = window
const e = prefix('tabs')
const MenuItem = Menu.Item
const extraWidth = 113


export default class Tabs extends React.Component {

  componentDidMount() {
    this.dom = document.querySelector('.tabs-inner')
    window.addEventListener('keydown', this.handleTabHotkey)
  }

  componentDidUpdate() {
    this.adjustScroll()
  }

  componentWillUnmount() {
    window.removeEventListener('keydown', this.handleTabHotkey)
  }

  handleTabHotkey = e => {
    if (
      e.ctrlKey &&
      e.code === 'Tab' &&
      e.shiftKey
    ) {
      this.props.clickNextTab()
    }
  }

  onAdd = e => {
    if (!e.target.className.includes('tabs-wrapper')) {
      return
    }
    this.props.addTab()
  }

  adjustScroll = () => {
    let {width, tabs, currentTabId} = this.props
    let index = _.findIndex(tabs, t => t.id === currentTabId)
    let w = (index + 1) * (tabMargin + tabWidth) + 5
    let scrollLeft = w > width - extraWidth
      ? w - width + extraWidth
      : 0
    this.dom.scrollLeft = scrollLeft
  }

  scrollLeft = () => {
    let {scrollLeft} = this.dom
    scrollLeft = scrollLeft - tabMargin - tabWidth
    if (scrollLeft < 0) {
      scrollLeft = 0
    }
    this.dom.scrollLeft = scrollLeft
  }

  scrollRight = () => {
    let {scrollLeft} = this.dom
    scrollLeft = scrollLeft + tabMargin + tabWidth
    if (scrollLeft < 0) {
      scrollLeft = 0
    }
    this.dom.scrollLeft = scrollLeft
  }

  onClickMenu = ({key}) => {
    let id = key.split('##')[1]
    this.props.onChangeTabId(id)
  }

  renderList = () => {
    let {tabs = []} = this.props
    return (
      <Menu onClick={this.onClickMenu}>
        {
          tabs.map((t, i) => {
            return (
              <MenuItem
                key={i + '##' + t.id}
              >{createName(t)}
              </MenuItem>
            )
          })
        }
      </Menu>
    )
  }

  renderAddBtn = () => {
    return (
      <Icon
        type="plus-circle-o"
        title={e('openNewTerm')}
        className="pointer tabs-add-btn font16"
        onClick={() => this.props.addTab()}
      />
    )
  }

  renderExtra() {
    return (
      <div className="tabs-extra pd1x">
        {this.renderAddBtn()}
        <Icon
          type="left"
          className="mg1l iblock pointer font16 tab-scroll-icon"
          onClick={this.scrollLeft}

        />
        <Icon
          type="right"
          className="mg1x iblock pointer font16 tab-scroll-icon"
          onClick={this.scrollRight}
        />
        <Dropdown
          className="iblock"
          placement="bottomRight"
          overlay={this.renderList()}
        >
          <Icon type="down" className="tabs-dd-icon" />
        </Dropdown>
      </div>
    )
  }

  render() {
    let {tabs = [], width} = this.props
    let len = tabs.length
    let addBtnWidth = 22
    let tabsWidthAll = (tabMargin + tabWidth) * len + 10
    let overflow = width < (tabsWidthAll + addBtnWidth)
    //let extraw = overflow ? extraWidth : 0
    return (
      <div className="tabs noise">
        <div
          className="tabs-inner"
          style={{
            width
          }}
        >
          <div
            className="tabs-wrapper relative"
            style={{
              width: tabsWidthAll + extraWidth + 10
            }}
            onDoubleClick={this.onAdd}
          >
            {
              tabs.map((tab, i) => {
                return (
                  <Tab
                    {...this.props}
                    tab={tab}
                    key={i + '##' + tab.id}
                  />
                )
              })
            }
            {
              !overflow
                ? this.renderAddBtn()
                : null
            }
          </div>
        </div>
        <div className="app-drag" />
        <WindowControl
          isMaximized={this.props.isMaximized}
        />
        {
          overflow
            ? this.renderExtra()
            : null
        }
      </div>
    )
  }

}
