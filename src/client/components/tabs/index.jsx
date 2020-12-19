/**
 * session tabs component
 * @param {array} props.tabs {id, title}
 */

import React from 'react'
import _ from 'lodash'

import {
  CodeFilled,
  DownOutlined,
  LeftOutlined,
  PlusCircleOutlined,
  RightOutlined,
  RightSquareFilled
} from '@ant-design/icons'

import { Dropdown, Menu, Popover } from 'antd'
import Tab from './tab'
import './tabs.styl'
import { tabWidth, tabMargin, extraTabWidth } from '../../common/constants'
import createName from '../../common/create-title'
import WindowControl from './window-control'
import BookmarksList from '../sidebar/bookmark-select'

const { prefix } = window
const e = prefix('tabs')
const c = prefix('control')
const t = prefix('tabs')
const MenuItem = Menu.Item

export default class Tabs extends React.Component {
  componentDidMount () {
    this.dom = document.querySelector('.tabs-inner')
    window.addEventListener('keydown', this.handleTabHotkey)
  }

  componentDidUpdate (prevProps) {
    prevProps = prevProps || {}
    if (
      prevProps.currentTabId !== this.props.currentTabId ||
      prevProps.width !== this.props.width ||
      prevProps.tabs.map(d => d.title).join('#') !== this.props.tabs.map(d => d.title).join('#')
    ) {
      this.adjustScroll()
    }
  }

  componentWillUnmount () {
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
    const { tabs = [], width } = this.props
    const len = tabs.length
    const addBtnWidth = 22
    const tabsWidth = this.tabsWidth()
    const tabsWidthAll = tabMargin * len + 130 + tabsWidth
    return width < (tabsWidthAll + addBtnWidth)
  }

  handleTabHotkey = e => {
    if (
      e.ctrlKey &&
      e.code === 'Tab' &&
      e.shiftKey
    ) {
      this.props.store.clickNextTab()
    }
  }

  onAdd = e => {
    if (!e.target.className.includes('tabs-wrapper')) {
      return
    }
    this.props.store.addTab()
  }

  adjustScroll = () => {
    const { width, tabs, currentTabId } = this.props
    const index = _.findIndex(tabs, t => t.id === currentTabId)
    const tabsDomWith = Array.from(
      document.querySelectorAll('.tab')
    ).slice(0, index + 2).reduce((prev, c) => {
      return prev + c.clientWidth
    }, 0)
    const w = (index + 1) * tabMargin + 5 + tabsDomWith
    const scrollLeft = w > width - extraTabWidth
      ? w - width + extraTabWidth
      : 0
    this.dom.scrollLeft = scrollLeft
  }

  scrollLeft = () => {
    let { scrollLeft } = this.dom
    scrollLeft = scrollLeft - tabMargin - tabWidth
    if (scrollLeft < 0) {
      scrollLeft = 0
    }
    this.dom.scrollLeft = scrollLeft
  }

  scrollRight = () => {
    let { scrollLeft } = this.dom
    scrollLeft = scrollLeft + tabMargin + tabWidth
    if (scrollLeft < 0) {
      scrollLeft = 0
    }
    this.dom.scrollLeft = scrollLeft
  }

  onClickMenu = ({ key }) => {
    const id = key.split('##')[1]
    this.props.store.onChangeTabId(id)
  }

  renderList = () => {
    const { tabs = [] } = this.props
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

  renderMenus () {
    const { onNewSsh, addTab } = this.props.store
    const cls = 'pd2x pd1y context-item pointer'
    return (
      <div className='add-menu-wrap' style={{
        maxHeight: window.innerHeight - 200
      }}>
        <div
          className={cls}
          onClick={onNewSsh}
        >
          <CodeFilled /> {c('newSsh')}
        </div>
        <div
          className={cls}
          onClick={() => addTab()}
        >
          <RightSquareFilled /> {t('newTab')}
        </div>
        <BookmarksList
          store={this.props.store}
        />
      </div>
    )
  }

  renderAddBtn = () => {
    return (
      <Popover
        content={this.renderMenus()}
      >
        <PlusCircleOutlined
          title={e('openNewTerm')}
          className='pointer tabs-add-btn font16'
          onClick={() => this.props.store.addTab()} />
      </Popover>
    )
  }

  renderExtra () {
    return (
      <div className='tabs-extra noise pd1x'>
        {this.renderAddBtn()}
        <LeftOutlined
          className='mg1l iblock pointer font12 tab-scroll-icon'
          onClick={this.scrollLeft} />
        <RightOutlined
          className='mg1x iblock pointer font12 tab-scroll-icon'
          onClick={this.scrollRight} />
        <Dropdown
          className='iblock'
          placement='bottomRight'
          overlay={this.renderList()}
        >
          <DownOutlined className='tabs-dd-icon' />
        </Dropdown>
      </div>
    )
  }

  render () {
    const { tabs = [], width } = this.props
    const len = tabs.length
    const tabsWidthAll = tabMargin * len + 10 + this.tabsWidth()
    const overflow = this.isOverflow()
    const left = overflow
      ? '100%'
      : tabsWidthAll
    return (
      <div className='tabs noise'>
        <div
          className='tabs-inner'
          style={{
            width
          }}
        >
          <div
            style={{
              left
            }}
          />
          <div
            className='tabs-wrapper relative'
            style={{
              width: tabsWidthAll + extraTabWidth + 10
            }}
            onDoubleClick={this.onAdd}
          >
            {
              tabs.map((tab) => {
                return (
                  <Tab
                    {...this.props}
                    tab={tab}
                    key={tab.id}
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
        <div className='app-drag' />
        <WindowControl
          isMaximized={this.props.isMaximized}
          closeApp={this.props.store.exit}
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
