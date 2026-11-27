/**
 * session tabs component
 */

import { Component } from 'manate/react/class-components'
import React from 'react'
import runIdle from '../../common/run-idle'
import { throttle } from 'lodash-es'
import SessionList from './session-list'
import {
  LeftOutlined,
  RightOutlined
} from '@ant-design/icons'
import Tab from './tab'
import LayoutMenu from './layout-menu'
import './tabs.styl'
import {
  tabWidth,
  tabMargin,
  extraTabWidth,
  windowControlWidth,
  getWindowControlsOverlayWidth,
  isMacJs
} from '../../common/constants'
import WindowControl from './window-control'
import AddBtn from './add-btn'
import AppDrag from './app-drag'
import NoSession from './no-session'
import BookmarkBar from '../bookmark-bar/bookmark-bar'
import classNames from 'classnames'

export default class Tabs extends Component {
  constructor (props) {
    super(props)
    this.tabsRef = React.createRef()
    this.domRef = React.createRef()
    this.rowRef = React.createRef()
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
    this.resizeObserver = new ResizeObserver(this.updateOverflow)
    this.observeTabBar()
  }

  componentDidUpdate (prevProps) {
    this.observeTabBar()
    if (
      prevProps.currentBatchTabId !== this.props.currentBatchTabId ||
      prevProps.width !== this.props.width ||
      (prevProps.tabs || []).length !== (this.props.tabs || []).length
    ) {
      this.adjustScroll()
    }
  }

  componentWillUnmount () {
    this.resizeObserver.disconnect()
  }

  observeTabBar () {
    const row = this.rowRef.current
    if (row === this.observedRow) return
    this.resizeObserver.disconnect()
    this.observedRow = row
    if (row) {
      this.resizeObserver.observe(row)
      this.resizeObserver.observe(this.domRef.current)
    }
    this.updateOverflow()
  }

  updateOverflow = () => {
    const row = this.rowRef.current
    const overflow = !!(row && this.props.tabs?.length && row.offsetWidth > this.domRef.current.clientWidth)
    if (overflow !== this.state.overflow) {
      this.setState({ overflow })
    }
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

  handleAdd = e => {
    if (e.target !== e.currentTarget) {
      return
    }
    window.store.addTab(
      undefined, undefined,
      this.props.batch
    )
  }

  handleTabAdd = () => {
    if (!window.store.hasNodePty) {
      window.store.onNewSsh()
      return
    }
    window.store.addTab(
      undefined, undefined,
      this.props.batch
    )
  }

  // desktop tabs bar renders pinned tabs first: stable partition that keeps
  // the original relative order inside the pinned and unpinned groups.
  // store.tabs order itself is untouched by pinning.
  getSortedTabs = () => {
    const { tabs = [] } = this.props
    return [
      ...tabs.filter(t => t.isPinned),
      ...tabs.filter(t => !t.isPinned)
    ]
  }

  adjustScroll = () => {
    if (this.props.isMobile || !this.domRef.current) {
      return
    }
    const { currentBatchTabId } = this.props
    const tabs = this.getSortedTabs()
    const index = tabs.findIndex(t => t.id === currentBatchTabId)
    const tabsDomWith = Array.from(
      this.domRef.current.querySelectorAll('.tab')
    ).slice(0, index + 2).reduce((prev, c) => {
      return prev + c.clientWidth
    }, 0)
    const w = (index + 1) * tabMargin + tabsDomWith
    const tabsInnerWidth = this.domRef.current.clientWidth
    const scrollLeft = w > tabsInnerWidth
      ? w - tabsInnerWidth
      : 0
    this.domRef.current.scrollTo({ left: scrollLeft, behavior: 'smooth' })
  }

  handleScrollLeft = () => {
    if (!this.domRef.current) {
      return
    }
    let { scrollLeft } = this.domRef.current
    scrollLeft = scrollLeft - tabMargin - tabWidth
    if (scrollLeft < 0) {
      scrollLeft = 0
    }
    this.domRef.current.scrollTo({ left: scrollLeft, behavior: 'smooth' })
  }

  handleScrollRight = () => {
    if (!this.domRef.current) {
      return
    }
    let { scrollLeft } = this.domRef.current
    scrollLeft = scrollLeft + tabMargin + tabWidth
    if (scrollLeft < 0) {
      scrollLeft = 0
    }
    this.domRef.current.scrollTo({ left: scrollLeft, behavior: 'smooth' })
  }

  handleWheelEvent = throttle((e) => {
    if (this.state.overflow) {
      if (e.deltaY < 0) {
        this.handleScrollLeft()
      } else {
        this.handleScrollRight()
      }
    }
  }, 100, { leading: true, trailing: true })

  renderSessionList (tabs) {
    return (
      <SessionList
        tabs={tabs}
        isMobile={this.props.isMobile}
        config={this.props.config}
        batch={this.props.batch}
      />
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
      <AddBtn
        className={cls}
        empty={!this.props.tabs?.length}
        batch={this.props.batch}
        addPanelWidth={this.props.addPanelWidth}
      />
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
        {this.renderSessionList(this.getSortedTabs())}
        {
          this.renderLayoutMenu()
        }
      </div>
    )
  }

  renderContent () {
    if (window.store.hasNativeTitleStrip) {
      return this.renderContentInner()
    }
    return (
      <AppDrag>
        {this.renderContentInner()}
      </AppDrag>
    )
  }

  renderContentInner () {
    const tabs = this.getSortedTabs()
    const len = tabs.length
    const { overflow } = this.state
    const w1 = isMacJs && (window.store.isSystemTitleBar || window.et.isWebApp)
      ? 30
      : this.getExtraTabWidth()
    const style = {
      width: `max(0px, calc(100% - ${w1 + 166}px))`
    }
    return (
      <div
        className='tabs-inner'
        ref={this.domRef}
        style={style}
      >
        <div
          className='tabs-wrapper relative'
          style={{ paddingRight: extraTabWidth }}
          onDoubleClick={this.handleAdd}
        >
          <div ref={this.rowRef} className={classNames('tabs-row', { overflow })}>
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
      </div>
    )
  }

  renderLayoutMenu = () => {
    return (
      <LayoutMenu
        layout={this.props.layout}
        visible={this.shouldRenderWindowControl()}
      />
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

  // The pane whose tab bar sits under Windows' native caption buttons is the
  // same pane that owns the window controls; only it has to clear that strip.
  // The pinned right panel takes that role over: it is a full-height dock
  // owning the right column (layout.jsx reserves rightPanelWidth), so the
  // buttons land on the strip the panel reserves (side-panel-r/
  // right-side-panel.styl) and the tab bar stops at the panel's left edge.
  // Clearing the strip there protects nothing — it just leaves a dead gap the
  // width of the caption buttons at the end of the tab bar.
  wcoBarNeedsClearance = () => {
    const {
      isMobile,
      isWindowControlsOverlay,
      rightPanelPinned,
      rightPanelVisible
    } = window.store
    if (!isWindowControlsOverlay || !this.shouldRenderWindowControl()) {
      return false
    }
    const pinnedRightPanel = !isMobile && rightPanelVisible && rightPanelPinned
    return !pinnedRightPanel
  }

  getExtraTabWidth = () => {
    if (!this.shouldRenderWindowControl()) {
      return 0
    }
    // not the overlay: the buttons are ours, drawn inside this pane's tab bar,
    // so they take their room whether the right panel is docked or not
    if (!window.store.isWindowControlsOverlay) {
      return windowControlWidth
    }
    return this.wcoBarNeedsClearance()
      ? getWindowControlsOverlayWidth()
      : 0
  }

  tabBarProps (extra) {
    const clearsOverlay = this.wcoBarNeedsClearance()
    return {
      className: classNames('tabs', extra, { 'wco-bar': clearsOverlay }),
      ref: this.tabsRef,
      style: clearsOverlay
        ? { '--wco-controls-width': `${getWindowControlsOverlayWidth()}px` }
        : undefined
    }
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

  renderMobileTabsExtra (tabs) {
    return (
      <div className='mobile-tabs-extra'>
        {this.renderAddBtn()}
        {
          tabs.length
            ? this.renderSessionList(tabs)
            : null
        }
      </div>
    )
  }

  renderMobileTabsInner (currentTabEl) {
    const inner = (
      <div className='tabs-inner mobile-tabs-inner'>
        {currentTabEl}
      </div>
    )
    if (window.store.hasNativeTitleStrip) {
      return inner
    }
    return (
      <AppDrag>
        {inner}
      </AppDrag>
    )
  }

  renderMobileTabs () {
    const { tabs = [], currentBatchTabId } = this.props
    const currentTab = tabs.find(t => t.id === currentBatchTabId)
    const tabProps = {
      ...this.props,
      tab: currentTab,
      isLast: true,
      addTab: this.handleTabAdd,
      tabIndex: 0
    }
    const currentTabEl = currentTab
      ? <Tab {...tabProps} key={currentTab.id} />
      : null
    return (
      <div {...this.tabBarProps('mobile-tabs')}>
        {this.renderMobileTabsInner(currentTabEl)}
        {this.renderMobileTabsExtra(tabs)}
        {this.renderWindowControl()}
      </div>
    )
  }

  renderTabs () {
    const { overflow } = this.state
    if (this.props.isMobile) {
      return this.renderMobileTabs()
    }
    return (
      <div {...this.tabBarProps()}>
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

  // The bookmark bar is the second row of this pane's header, so it is rendered
  // right after the tab strip and belongs to the same pane — see
  // bookmark-bar.jsx for why it is per pane and not once per window.
  renderBookmarkBar = () => {
    if (!window.store.bookmarkBarVisible) {
      return null
    }
    return (
      <BookmarkBar batch={this.props.batch} />
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
          {this.renderBookmarkBar()}
          {this.renderNoSession()}
        </div>
      )
    }
    return (
      <>
        {this.renderTabs()}
        {this.renderBookmarkBar()}
      </>
    )
  }
}
