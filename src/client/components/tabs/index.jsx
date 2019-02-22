/**
 * session tabs component
 * @param {array} props.tabs {id, title}
 */

import React from 'react'
import _ from 'lodash'
import {Icon, Dropdown, Menu, Popover} from 'antd'
import Tab from './tab'
import './tabs.styl'
import {tabWidth, tabMargin} from '../../common/constants'
import createName from '../../common/create-title'
import WindowControl from './window-control'
import BookmarksList from '../sidebar/bookmark-select'

const {prefix} = window
const e = prefix('tabs')
const c = prefix('control')
const t = prefix('tabs')
const MenuItem = Menu.Item
const extraWidth = 113


export default class Tabs extends React.Component {

  componentDidMount() {
    this.dom = document.querySelector('.tabs-inner')
    window.addEventListener('keydown', this.handleTabHotkey)
  }

  componentDidUpdate(prevState, prevProps) {
    prevProps = prevProps || {}
    if (
      prevProps.currentTabId !== this.props.currentTabId ||
      prevProps.width !== this.props.width ||
      prevProps.map(d => d.title).join('#') !== this.props.map(d => d.title).join('#')
    ) {
      this.adjustScroll()
    }
  }

  componentWillUnmount() {
    window.removeEventListener('keydown', this.handleTabHotkey)
  }

  tabsWidth = () => {
    return Array.from(
      document.querySelectorAll('.tab')
    ).reduce((prev, c) => {
      return prev + c.clientWidth
    }, 0)
  }

  isOverflow = () => {
    let {tabs = [], width} = this.props
    let len = tabs.length
    let addBtnWidth = 22
    let tabsWidth = this.tabsWidth()
    let tabsWidthAll = tabMargin * len + 10 + tabsWidth
    return width < (tabsWidthAll + addBtnWidth)
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
    let tabsDomWith = Array.from(
      document.querySelectorAll('.tab')
    ).slice(0, index + 2).reduce((prev, c) => {
      return prev + c.clientWidth
    }, 0)
    let w = (index + 1) * tabMargin + 5 + tabsDomWith
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

  renderMenus() {
    let {onNewSsh, addTab} = this.props
    let cls = 'pd2x pd1y context-item pointer'
    return (
      <div className="add-menu-wrap">
        <div
          className={cls}
          onClick={() => addTab()}
        >
          <Icon type="code" theme="filled" /> {c('newSsh')}
        </div>
        <div
          className={cls}
          onClick={onNewSsh}
        >
          <Icon type="right-square" theme="filled" /> {t('newTab')}
        </div>
        <BookmarksList
          {...this.props}
        />
      </div>
    )
  }

  renderAddBtn = () => {
    return (
      <Popover
        content={this.renderMenus()}
      >
        <Icon
          type="plus-circle-o"
          title={e('openNewTerm')}
          className="pointer tabs-add-btn font16"
          onClick={() => this.props.addTab()}
        />
      </Popover>
    )
  }

  renderExtra() {
    return (
      <div className="tabs-extra noise pd1x">
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
    let tabsWidthAll = tabMargin * len + 10 + this.tabsWidth()
    let overflow = this.isOverflow()
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
