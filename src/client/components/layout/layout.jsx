import { Component } from '../common/react-subx'
import Layouts from './layouts'
// import Sessions from '../session/sessions'
import {
  splitConfig,
  quickCommandBoxHeight,
  footerHeight,
  termControlHeight
} from '../../common/constants'
import layoutAlg from './layout-alg'

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

  renderSessions () {

  }

  render () {
    const { store } = this.props
    const {
      layout
    } = store
    const conf = splitConfig[layout]
    const layoutProps = {
      layout,
      ...this.buildLayoutStyles(conf),
      layoutStyle: this.calcLayoutStyle(),
      handleMousedown: this.handleMousedown
    }
    return (
      <Layouts {...layoutProps}>
        {this.renderSessions()}
      </Layouts>
    )
  }
}
