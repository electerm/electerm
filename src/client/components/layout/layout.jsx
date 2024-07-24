import { Component } from '../common/react-subx'
import Layouts from './layouts'
import Sessions from '../session2/sessions'
import {
  splitConfig,
  quickCommandBoxHeight,
  footerHeight,
  termControlHeight
} from '../../common/constants'
import layoutAlg from './layout-alg'
import calcSessionSize from './session-size-alg'
import TermSearch from '../terminal/term-search.jsx'
import Footer from '../footer/footer-entry.jsx'
import QuickCommandsFooterBox from '../quick-commands/quick-commands-box.jsx'

export default class Layout extends Component {
  handleMousedown = (e) => {

  }

  calcLayoutStyle = () => {
    const {
      width,
      height,
      pinnedQuickCommandBar,
      tabsHeight,
      leftSidebarWidth,
      infoPanelPinned,
      pinned,
      rightSidebarWidth
    } = this.props.store
    const h = height - tabsHeight - footerHeight - termControlHeight - (pinnedQuickCommandBar ? quickCommandBoxHeight : 0)
    const l = pinned ? leftSidebarWidth : 0
    const r = infoPanelPinned ? rightSidebarWidth : 0
    return {
      height: h,
      top: 0,
      left: l,
      right: r,
      width: width - l - r - 42
    }
  }

  toCssStyle = (conf) => {
    return Object.keys(conf).reduce((prev, key) => {
      const v = conf[key]
      return {
        ...prev,
        [key]: v + 'px'
      }
    }, {})
  }

  buildLayoutStyles = () => {
    const {
      layout,
      height,
      width,
      pinnedQuickCommandBar,
      tabsHeight,
      leftSidebarWidth,
      infoPanelPinned,
      pinned,
      rightSidebarWidth
    } = this.props.store
    const l = pinned ? leftSidebarWidth : 0
    const r = infoPanelPinned ? rightSidebarWidth : 0
    const w = width - l - r - 42
    const h = height - tabsHeight - footerHeight - termControlHeight - (pinnedQuickCommandBar ? quickCommandBoxHeight : 0)
    return layoutAlg(layout, w, h)
  }

  renderSessions (conf, layout) {
    const {
      width,
      height
    } = this.calcLayoutStyle()
    const {
      store
    } = this.props
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
        store,
        config: store.config,
        tabs: tabsBatch[i]
      }
      return (
        <Sessions
          key={'sess' + i}
          {...sessProps}
        />
      )
    })
  }

  render () {
    const { store } = this.props
    const {
      layout, config, currentTab
    } = store
    const conf = splitConfig[layout]
    const layoutProps = {
      layout,
      ...this.buildLayoutStyles(conf, layout),
      layoutStyle: this.calcLayoutStyle(),
      handleMousedown: this.handleMousedown
    }
    const termProps = {
      currentTab,
      store,
      config
    }
    const footerProps = {
      store,
      currentTab
    }
    return [
      <Layouts {...layoutProps} key='layouts'>
        {this.renderSessions(conf, layout)}
      </Layouts>,
      <TermSearch
        key='TermSearch'
        {...termProps}
      />,
      <QuickCommandsFooterBox
        key='QuickCommandsFooterBox'
        store={store}
      />,
      <Footer
        key='Footer'
        {...footerProps}
      />
    ]
  }
}
