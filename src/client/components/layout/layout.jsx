import { auto } from 'manate/react'
import { useState } from 'react'
import Layouts from './layouts'
import TabsWrap from '../tabs/index'
import QuickConnect from '../tabs/quick-connect'
import {
  splitConfig,
  footerHeight
} from '../../common/constants'
import layoutAlg from './layout-alg'
import calcSessionSize from './session-size-alg'
import TermSearch from '../terminal/term-search'
import Footer from '../footer/footer-entry'
import SessionsWrap from '../session/sessions'
import pixed from './pixed'
import TerminalToolbar, { toolbarHeight } from './terminal-toolbar'
import { pick } from 'lodash-es'
import './layout.styl'

export default auto(function Layout (props) {
  const { store } = props
  const {
    layout, config, currentTab
  } = store
  const conf = splitConfig[layout]
  const toolbar = !store.isMobile && !store.fullscreen
  const [controlsHost, setControlsHost] = useState(null)
  const [sftpPercent, setSftpPercent] = useState(20)

  const handleMousedown = (e) => {

  }

  const calcLayoutStyle = () => {
    const {
      width,
      height,
      isMobile,
      leftSidePanelWidth,
      leftSideBarWidth,
      pinned,
      rightPanelVisible,
      rightPanelPinned,
      rightPanelWidth,
      resizeTrigger
    } = props.store
    const top = toolbar ? toolbarHeight : 0
    const h = height - footerHeight - top + resizeTrigger
    const l = pinned && !isMobile ? leftSideBarWidth + leftSidePanelWidth : leftSideBarWidth
    const r = rightPanelVisible && rightPanelPinned && !isMobile ? rightPanelWidth : 0
    return {
      height: h,
      top,
      left: l,
      width: Math.max(0, width - l - r)
    }
  }

  const layoutSize = calcLayoutStyle()
  const {
    width,
    height
  } = layoutSize
  const pixedLayoutStyle = pixed(layoutSize)
  const styles = layoutAlg(layout, width, height)
  const layoutProps = {
    layout,
    ...styles,
    layoutStyle: pixedLayoutStyle,
    handleMousedown
  }
  const sizes = calcSessionSize(layout, width, height).map(size => ({
    ...size,
    sidebarWidth: toolbar ? Math.min(size.width * 0.6, Math.max(144, size.width * sftpPercent / 100)) : 0
  }))

  function renderSessions (conf, layout) {
    const {
      store
    } = props
    const { tabs } = store
    const tabsBatch = {}
    for (const tab of tabs) {
      let { batch } = tab
      // Guard against tabs with missing/invalid batch (e.g. created by
      // MCP/AI operations before sanitization). Route them to pane 0
      // instead of crashing or disappearing.
      batch = Number(batch)
      if (!Number.isInteger(batch) || batch < 0 || batch >= sizes.length) {
        batch = 0
      }
      if (!tabsBatch[batch]) {
        tabsBatch[batch] = []
      }
      tabsBatch[batch].push(tab)
    }
    return sizes.map((v, i) => {
      const batchTabs = tabsBatch[i] || []
      const currentBatchTabId = store[`activeTabId${i}`]
      const connectWidth = v.sidebarWidth
      const sessProps = {
        batch: i,
        layout,
        currentBatchTabId,
        ...v,
        width: v.width - connectWidth,
        tabs: batchTabs,
        ...pick(store, [
          'isMaximized',
          'config',
          'resolutions',
          'fileOperation',
          'pinnedQuickCommandBar',
          'tabsHeight',
          'appPath',
          'leftSidePanelWidth',
          'addPanelWidth',
          'pinned',
          'openedSideBar',
          'isMobile'
        ])
      }
      return (
        <div className='pane-header' key={'sess' + i}>
          {connectWidth > 0 && (
            <div className='pane-connect' style={{ width: connectWidth }}>
              <QuickConnect inputOnly compact batch={i} />
            </div>
          )}
          <TabsWrap {...sessProps} />
        </div>
      )
    })
  }

  const termProps = {
    currentTab,
    config,
    ...pick(store, [
      'activeTabId',
      'termSearchOpen',
      'termSearch',
      'termSearchOptions',
      'termSearchMatchCount',
      'termSearchMatchIndex'
    ])
  }
  const footerProps = {
    store
  }
  const sessionsProps = {
    sftpPercent,
    setSftpPercent,
    controlsHost: toolbar ? controlsHost : null,
    styles: styles.wrapStyles,
    sizes,
    width,
    height,
    layoutStyle: pixedLayoutStyle,
    ...pick(store, [
      'activeTabId',
      'activeTabId0',
      'activeTabId1',
      'activeTabId2',
      'activeTabId3',
      'batch',
      'resolutions',
      'fileOperation',
      'file',
      'pinnedQuickCommandBar',
      'tabsHeight',
      'appPath',
      'leftSidePanelWidth',
      'pinned',
      'openedSideBar',
      'config',
      'fullscreen'
    ]),
    tabs: store.tabs,
    layout
  }
  return [
    toolbar && (
      <TerminalToolbar key='toolbar' store={store} transfers={props.transfers} controlsRef={setControlsHost} />
    ),
    <Layouts {...layoutProps} key='layouts'>
      {renderSessions(conf, layout)}
    </Layouts>,
    <SessionsWrap key='SessionsWrap' {...sessionsProps} />,
    <TermSearch
      key='TermSearch'
      {...termProps}
    />,
    <Footer
      key='Footer'
      {...footerProps}
    />
  ]
})
