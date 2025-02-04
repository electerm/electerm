/**
 * session tabs component
 */

import { Component } from '../common/component'
import React from 'react'
import runIdle from '../../common/run-idle'
import { throttle } from 'lodash-es'
import TabTitle from './tab-title'
import {
  CodeFilled,
  DownOutlined,
  LeftOutlined,
  PlusOutlined,
  RightOutlined,
  RightSquareFilled
} from '@ant-design/icons'
import {
  SingleIcon,
  TwoColumnsIcon,
  ThreeColumnsIcon,
  TwoRowsIcon,
  ThreeRowsIcon,
  Grid2x2Icon,
  TwoRowsRightIcon,
  TwoColumnsBottomIcon
} from '../icons/split-icons'
import { Dropdown, Popover } from 'antd'
import Tab from './tab'
import './tabs.styl'
import {
  tabWidth,
  tabMargin,
  extraTabWidth,
  windowControlWidth,
  isMacJs,
  splitMapDesc
} from '../../common/constants'
import WindowControl from './window-control'
import BookmarksList from '../sidebar/bookmark-select'
import AppDrag from './app-drag'
import NoSession from './no-session'
import classNames from 'classnames'

const e = window.translate

export default class Tabs extends Component {
  constructor (props) {
    super(props)
    this.tabsRef = React.createRef()
    this.domRef = React.createRef()
    this.state = {
      overflow: false
    }
  }

  componentDidMount () {
    const {
      tabsRef
    } = this
    tabsRef.current.addEventListener('wheel', this.handleWheelEvent, {
      passive: false
    })
  }

  componentDidUpdate (prevProps) {
    if (
      prevProps.currentBatchTabId !== this.props.currentBatchTabId ||
      prevProps.width !== this.props.width ||
      (prevProps.tabs || []).length !== (this.props.tabs || []).length
    ) {
      this.adjustScroll()
    }
  }

  componentWillUnmount () {
  }

  modifier = (...args) => {
    runIdle(() => this.setState(...args))
  }

  handleNewTab = () => {
    window.store.addTab(undefined, undefined, this.props.batch)
  }

  handleNewSsh = () => {
    window.store.onNewSsh()
  }

  tabsWidth = () => {
    const { batch } = this.props
    return Array.from(
      document.querySelectorAll(`.v${batch + 1} .tab`)
    ).reduce((prev, c) => {
      return prev + c.clientWidth
    }, 0)
  }

  isOverflow = () => {
    const { tabs = [] } = this.props
    const len = tabs.length
    const addBtnWidth = 22
    const tabsWidth = this.tabsWidth() + tabMargin * len + addBtnWidth
    const tabsInnerWidth = this.getInnerWidth()
    return tabsWidth > tabsInnerWidth
  }

  getInnerWidth = () => {
    const { batch } = this.props
    const cls = `.v${batch + 1} .tabs-inner`
    const inner = document.querySelector(cls)
    return inner ? inner.clientWidth : 0
  }

  handleAdd = e => {
    if (!e.target.className.includes('tabs-wrapper')) {
      return
    }
    window.store.addTab(
      undefined, undefined,
      this.props.batch
    )
  }

  handleTabAdd = () => {
    window.store.addTab(
      undefined, undefined,
      this.props.batch
    )
  }

  adjustScroll = () => {
    const { tabs, currentBatchTabId, batch } = this.props
    const index = tabs.findIndex(t => t.id === currentBatchTabId)
    const tabsDomWith = Array.from(
      document.querySelectorAll(`.v${batch + 1} .tab`)
    ).slice(0, index + 2).reduce((prev, c) => {
      return prev + c.clientWidth
    }, 0)
    const w = (index + 1) * tabMargin + tabsDomWith
    const tabsInnerWidth = this.getInnerWidth()
    const scrollLeft = w > tabsInnerWidth
      ? w - tabsInnerWidth
      : 0
    this.domRef.current.scrollTo({ left: scrollLeft, behavior: 'smooth' })
    this.setState({
      overflow: this.isOverflow()
    })
  }

  handleScrollLeft = () => {
    let { scrollLeft } = this.domRef.current
    scrollLeft = scrollLeft - tabMargin - tabWidth
    if (scrollLeft < 0) {
      scrollLeft = 0
    }
    this.domRef.current.scrollTo({ left: scrollLeft, behavior: 'smooth' })
  }

  handleScrollRight = () => {
    let { scrollLeft } = this.domRef.current
    scrollLeft = scrollLeft + tabMargin + tabWidth
    if (scrollLeft < 0) {
      scrollLeft = 0
    }
    this.domRef.current.scrollTo({ left: scrollLeft, behavior: 'smooth' })
  }

  handleWheelEvent = throttle((e) => {
    if (this.isOverflow()) {
      if (e.deltaY < 0) {
        this.handleScrollLeft()
      } else {
        this.handleScrollRight()
      }
    }
  }, 100, { leading: true, trailing: true })

  handleClickMenu = ({ key }) => {
    const id = key.split('##')[1]
    window.store['activeTabId' + this.props.batch] = id
  }

  handleChangeLayout = ({ key }) => {
    window.store.setLayout(key)
  }

  handleOpenChange = (open) => {
    if (open) {
      window.openTabBatch = this.props.batch
    }
  }

  renderMenus () {
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
          <CodeFilled /> {e('newBookmark')}
        </div>
        <div
          className={cls}
          onClick={this.handleTabAdd}
        >
          <RightSquareFilled /> {e('newTab')}
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
        empty: !this.props.tabs?.length
      }
    )
    return (
      <Popover
        content={this.renderMenus()}
        onOpenChange={this.handleOpenChange}
        placement='bottomRight'
      >
        <PlusOutlined
          title={e('openNewTerm')}
          className={cls}
          onClick={this.handleTabAdd}
        />
      </Popover>
    )
  }

  renderNoExtra () {
    return (
      <div className='tabs-extra pd1x'>
        {this.renderLayoutMenu()}
      </div>
    )
  }

  renderExtra () {
    const items = this.props.tabs.map((t, i) => {
      return {
        key: i + '##' + t.id,
        label: (
          <span><TabTitle tab={t} /></span>
        ),
        onClick: () => this.handleClickMenu({ key: i + '##' + t.id })
      }
    })
    const dropProps = {
      className: 'tabs-add-btn font16',
      menu: {
        items
      },
      placement: 'bottomRight'
    }
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
          {...dropProps}
        >
          <DownOutlined className='tabs-dd-icon' />
        </Dropdown>
        {
          this.renderLayoutMenu()
        }
      </div>
    )
  }

  renderContent () {
    const { config } = this.props
    if (config.useSystemTitleBar) {
      return this.renderContentInner()
    }
    return (
      <AppDrag>
        {this.renderContentInner()}
      </AppDrag>
    )
  }

  renderContentInner () {
    const { tabs = [], width, config } = this.props
    const len = tabs.length
    const tabsWidthAll = tabMargin * len + 10 + this.tabsWidth()
    const { overflow } = this.state
    const left = overflow
      ? '100%'
      : tabsWidthAll
    const w1 = isMacJs && (config.useSystemTitleBar || window.et.isWebApp)
      ? 30
      : this.getExtraTabWidth()
    const style = {
      width: width - w1 - 166
    }
    return (
      <div
        className='tabs-inner'
        ref={this.domRef}
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
              const tabProps = {
                ...this.props,
                tab,
                isLast,
                addTab: this.handleTabAdd,
                tabIndex: i
              }
              return (
                <Tab
                  {...tabProps}
                  key={tab.id}
                />
              )
            })
          }
          {
            overflow
              ? null
              : this.renderAddBtn()
          }
        </div>
      </div>
    )
  }

  getLayoutIcon = (layout) => {
    const iconMaps = {
      single: SingleIcon,
      twoColumns: TwoColumnsIcon,
      threeColumns: ThreeColumnsIcon,
      twoRows: TwoRowsIcon,
      threeRows: ThreeRowsIcon,
      grid2x2: Grid2x2Icon,
      twoRowsRight: TwoRowsRightIcon,
      twoColumnsBottom: TwoColumnsBottomIcon
    }
    return iconMaps[layout]
  }

  renderLayoutMenu = () => {
    if (!this.shouldRenderWindowControl()) {
      return null
    }
    const items = Object.keys(splitMapDesc).map((t) => {
      const v = splitMapDesc[t]
      const Icon = this.getLayoutIcon(v)
      return {
        key: t,
        label: (
          <span>
            <Icon /> {e(v)}
          </span>
        ),
        onClick: () => this.handleChangeLayout({ key: t })
      }
    })
    const v = splitMapDesc[this.props.layout]
    const Icon = this.getLayoutIcon(v)
    return (
      <Dropdown
        menu={{ items }}
        placement='bottomRight'
      >
        <span className='tabs-dd-icon layout-dd-icon mg1l'>
          <Icon /> <DownOutlined />
        </span>
      </Dropdown>
    )
  }

  shouldRenderWindowControl = () => {
    const { layout, batch } = this.props
    const batchToRender = {
      c1: 0,
      c2: 1,
      c3: 2,
      r2: 0,
      r3: 0,
      c2x2: 1,
      c1r2: 1,
      r1c2: 0
    }
    return batch === batchToRender[layout]
  }

  getExtraTabWidth = () => {
    return this.shouldRenderWindowControl()
      ? windowControlWidth
      : 0
  }

  renderWindowControl = () => {
    if (this.shouldRenderWindowControl()) {
      return (
        <WindowControl
          store={window.store}
        />
      )
    }
    return null
  }

  renderTabs () {
    const { overflow } = this.state
    return (
      <div className='tabs' ref={this.tabsRef}>
        {this.renderContent()}
        {
          this.renderWindowControl()
        }
        {
          overflow
            ? this.renderExtra()
            : this.renderNoExtra()
        }
      </div>
    )
  }

  renderNoSession = () => {
    return (
      <NoSession
        height={this.props.height}
        onNewTab={this.handleNewTab}
        onNewSsh={this.handleNewSsh}
        batch={this.props.batch}
      />
    )
  }

  render () {
    const {
      tabs
    } = this.props
    if (!tabs || !tabs.length) {
      return (
        <div className='tabs-outer'>
          {this.renderTabs()}
          {this.renderNoSession()}
        </div>
      )
    }
    return this.renderTabs()
  }
}
