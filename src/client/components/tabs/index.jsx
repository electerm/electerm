/**
 * session tabs component
 * @param {array} props.tabs {id, title}
 */

import React from 'react'
import { findIndex } from 'lodash-es'
import TabTitle from './tab-title'
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
import { tabWidth, tabMargin, extraTabWidth, windowControlWidth } from '../../common/constants'
import findParentBySel from '../../common/find-parent'
import WindowControl from './window-control'
import BookmarksList from '../sidebar/bookmark-select'
import AppDrag from './app-drag'
import classNames from 'classnames'

const { prefix } = window
const e = prefix('tabs')
const c = prefix('control')
const t = prefix('tabs')
const MenuItem = Menu.Item

export default class Tabs extends React.Component {
  constructor (props) {
    super(props)
    this.tabsRef = React.createRef()
  }

  componentDidMount () {
    this.dom = document.querySelector('.tabs-inner')
    const {
      tabsRef
    } = this
    tabsRef.current.addEventListener('mousedown', this.handleClickEvent)
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
    const tabsWidthAll = tabMargin * len + 216 + tabsWidth
    return width < (tabsWidthAll + addBtnWidth)
  }

  handleClickEvent = (e) => {
    if (e.button === 1) {
      const p = findParentBySel(e.target, '.tab')
      if (p) {
        const id = p.dataset.id
        this.props.delTab(id)
      }
    }
  }

  handleAdd = e => {
    if (!e.target.className.includes('tabs-wrapper')) {
      return
    }
    this.props.addTab()
  }

  adjustScroll = () => {
    const { width, tabs, currentTabId } = this.props
    const index = findIndex(tabs, t => t.id === currentTabId)
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

  handleScrollLeft = () => {
    let { scrollLeft } = this.dom
    scrollLeft = scrollLeft - tabMargin - tabWidth
    if (scrollLeft < 0) {
      scrollLeft = 0
    }
    this.dom.scrollLeft = scrollLeft
  }

  handleScrollRight = () => {
    let { scrollLeft } = this.dom
    scrollLeft = scrollLeft + tabMargin + tabWidth
    if (scrollLeft < 0) {
      scrollLeft = 0
    }
    this.dom.scrollLeft = scrollLeft
  }

  handleClickMenu = ({ key }) => {
    const id = key.split('##')[1]
    this.props.onChangeTabId(id)
  }

  renderList = () => {
    const { tabs = [] } = this.props
    return (
      <Menu onClick={this.handleClickMenu}>
        {
          tabs.map((t, i) => {
            return (
              <MenuItem
                key={i + '##' + t.id}
              >
                <TabTitle tab={t} />
              </MenuItem>
            )
          })
        }
      </Menu>
    )
  }

  renderMenus () {
    const { addTab } = this.props
    const { onNewSsh } = window.store
    const cls = 'pd2x pd1y context-item pointer'
    return (
      <div
        className='add-menu-wrap' style={{
          maxHeight: window.innerHeight - 200
        }}
      >
        <div
          className={cls}
          onClick={onNewSsh}
        >
          <CodeFilled /> {c('newBookmark')}
        </div>
        <div
          className={cls}
          onClick={() => addTab()}
        >
          <RightSquareFilled /> {t('newTab')}
        </div>
        <BookmarksList
          store={window.store}
        />
      </div>
    )
  }

  renderAddBtn = () => {
    const cls = classNames(
      'pointer tabs-add-btn font16',
      {
        empty: !this.props.tabs.length
      }
    )
    return (
      <Popover
        content={this.renderMenus()}
      >
        <PlusCircleOutlined
          title={e('openNewTerm')}
          className={cls}
          onClick={() => this.props.addTab()}
        />
      </Popover>
    )
  }

  renderExtra () {
    return (
      <div className='tabs-extra pd1x'>
        {this.renderAddBtn()}
        <LeftOutlined
          className='mg1l iblock pointer font12 tab-scroll-icon'
          onClick={this.handleScrollLeft}
        />
        <RightOutlined
          className='mg1x iblock pointer font12 tab-scroll-icon'
          onClick={this.handleScrollRight}
        />
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
    const style = {
      width: width - windowControlWidth - 86
    }
    return (
      <div className='tabs' ref={this.tabsRef}>
        <AppDrag>
          <div
            className='tabs-inner'
            style={style}
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
              onDoubleClick={this.handleAdd}
            >
              {
                tabs.map((tab, i) => {
                  const isLast = i === len - 1
                  return (
                    <Tab
                      {...this.props}
                      tab={tab}
                      isLast={isLast}
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
        </AppDrag>
        <WindowControl
          store={window.store}
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
