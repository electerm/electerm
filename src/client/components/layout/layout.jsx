import { auto } from 'manate/react'
import Layouts from './layouts'
import Sessions from '../session/sessions'
import {
  splitConfig,
  quickCommandBoxHeight,
  footerHeight
} from '../../common/constants'
import layoutAlg from './layout-alg'
import calcSessionSize from './session-size-alg'
import TermSearch from '../terminal/term-search'
import Footer from '../footer/footer-entry'
import QuickCommandsFooterBox from '../quick-commands/quick-commands-box'
import { pick } from 'lodash-es'
import './layout.styl'

export default auto(function Layout (props) {
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
      resizeTrigger
    } = props.store
    const h = height - footerHeight - (pinnedQuickCommandBar ? quickCommandBoxHeight : 0) + resizeTrigger
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
      infoPanelPinned,
      pinned,
      rightSidebarWidth
    } = props.store
    const l = pinned ? leftSidebarWidth : 0
    const r = infoPanelPinned ? rightSidebarWidth : 0
    const w = width - l - r - 42
    const h = height - footerHeight - (pinnedQuickCommandBar ? quickCommandBoxHeight : 0)
    return layoutAlg(layout, w, h)
  }

  function renderSessions (conf, layout) {
    const {
      width,
      height
    } = calcLayoutStyle()
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
    return calcSessionSize(layout, width, height).map((v, i) => {
      const sessProps = {
        batch: i,
        layout,
        ...v,
        tabs: tabsBatch[i] || [],
        ...pick(store, [
          'isMaximized',
          'config',
          'resolutions',
          'hideDelKeyTip',
          'fileOperation',
          'file',
          'pinnedQuickCommandBar',
          'tabsHeight',
          'appPath',
          'leftSidebarWidth',
          'pinned',
          'openedSideBar'
        ])
      }
      return (
        <Sessions
          key={'sess' + i}
          {...sessProps}
        />
      )
    })
  }

  const { store } = props
  const {
    layout, config, currentTab
  } = store
  const conf = splitConfig[layout]
  const layoutProps = {
    layout,
    ...buildLayoutStyles(conf, layout),
    layoutStyle: calcLayoutStyle(),
    handleMousedown
  }
  const termProps = {
    currentTab,
    config,
    ...pick(store, [
      'currentTabId',
      'termSearchOpen',
      'termSearch',
      'termSearchOptions',
      'termSearchMatchCount',
      'termSearchMatchIndex'
    ])
  }
  const footerProps = {
    store,
    currentTab
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
  return [
    <Layouts {...layoutProps} key='layouts'>
      {renderSessions(conf, layout)}
    </Layouts>,
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
