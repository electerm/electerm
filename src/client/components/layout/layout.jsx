import { auto } from 'manate/react'
import Layouts from './layouts'
import TabsWrap from '../tabs/index'
import {
  splitConfig,
  quickCommandBoxHeight,
  footerHeight
} from '../../common/constants'
import layoutAlg from './layout-alg'
import calcSessionSize from './session-size-alg'
import TermSearch from '../terminal/term-search'
import Footer from '../footer/footer-entry'
import SessionsWrap from '../session/sessions'
import QuickCommandsFooterBox from '../quick-commands/quick-commands-box'
import pixed from './pixed'
import { pick } from 'lodash-es'
import './layout.styl'

export default auto(function Layout (props) {
  const { store } = props
  const {
    layout, config, currentTab
  } = store
  const conf = splitConfig[layout]

  const handleMousedown = (e) => {

  }

  const calcLayoutStyle = () => {
    const {
      width,
      height,
      pinnedQuickCommandBar,
      // tabsHeight,
      leftSidebarWidth,
      // infoPanelPinned,
      pinned,
      rightPanelVisible,
      rightPanelPinned,
      rightPanelWidth,
      resizeTrigger,
      inActiveTerminal
    } = props.store
    const h = height - footerHeight - (inActiveTerminal && pinnedQuickCommandBar ? quickCommandBoxHeight : 0) + resizeTrigger
    const l = pinned ? 43 + leftSidebarWidth : 43
    const r = rightPanelVisible && rightPanelPinned ? rightPanelWidth : 0
    return {
      height: h,
      top: 0,
      left: l,
      width: width - l - r
    }
  }

  const buildLayoutStyles = () => {
    const {
      layout,
      height,
      width,
      pinnedQuickCommandBar,
      leftSidebarWidth,
      rightPanelVisible,
      rightPanelPinned,
      rightPanelWidth,
      pinned
    } = props.store
    const l = pinned ? leftSidebarWidth : 0
    const r = rightPanelPinned && rightPanelVisible ? rightPanelWidth : 0
    const w = width - l - r - 42
    const h = height - footerHeight - (pinnedQuickCommandBar ? quickCommandBoxHeight : 0)
    return layoutAlg(layout, w, h)
  }
  const layoutSize = calcLayoutStyle()
  const {
    width,
    height
  } = layoutSize
  const pixedLayoutStyle = pixed(layoutSize)
  const styles = buildLayoutStyles(conf, layout)
  const layoutProps = {
    layout,
    ...styles,
    layoutStyle: pixedLayoutStyle,
    handleMousedown
  }
  const sizes = calcSessionSize(layout, width, height)

  function renderSessions (conf, layout) {
    const {
      store
    } = props
    const { tabs } = store
    const tabsBatch = {}
    for (const tab of tabs) {
      const { batch } = tab
      if (!tabsBatch[batch]) {
        tabsBatch[batch] = []
      }
      tabsBatch[batch].push(tab)
    }
    return sizes.map((v, i) => {
      const sessProps = {
        batch: i,
        layout,
        currentBatchTabId: store[`activeTabId${i}`],
        ...v,
        tabs: tabsBatch[i] || [],
        ...pick(store, [
          'isMaximized',
          'config',
          'resolutions',
          'hideDelKeyTip',
          'fileOperation',
          'pinnedQuickCommandBar',
          'tabsHeight',
          'appPath',
          'leftSidebarWidth',
          'pinned',
          'openedSideBar'
        ])
      }
      return (
        <TabsWrap
          key={'sess' + i}
          {...sessProps}
        />
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
  const qmProps = pick(store, [
    'quickCommandTags',
    'qmSortByFrequency',
    'openQuickCommandBar',
    'pinnedQuickCommandBar',
    'qmSortByFrequency',
    'inActiveTerminal',
    'leftSidebarWidth',
    'openedSideBar',
    'currentQuickCommands'
  ])
  const sessionsProps = {
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
      'hideDelKeyTip',
      'fileOperation',
      'file',
      'pinnedQuickCommandBar',
      'tabsHeight',
      'appPath',
      'leftSidebarWidth',
      'pinned',
      'openedSideBar',
      'config'
    ]),
    tabs: store.tabs
  }
  return [
    <Layouts {...layoutProps} key='layouts'>
      {renderSessions(conf, layout)}
    </Layouts>,
    <SessionsWrap key='SessionsWrap' {...sessionsProps} />,
    <TermSearch
      key='TermSearch'
      {...termProps}
    />,
    <QuickCommandsFooterBox
      key='QuickCommandsFooterBox'
      {...qmProps}
    />,
    <Footer
      key='Footer'
      {...footerProps}
    />
  ]
})
