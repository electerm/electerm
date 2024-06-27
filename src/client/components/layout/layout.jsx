import { Component } from '../common/react-subx'
import Layouts from './layouts'
import Sessions from '../session/sessions'
import {
  splitConfig,
  quickCommandBoxHeight,
  footerHeight,
  termControlHeight,
  splitMap
} from '../../common/constants'

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
    const config = splitConfig[layout]
    const {
      children: childrenCount,
      handle: handleCount
    } = config
    const l = pinned ? leftSidebarWidth : 0
    const r = infoPanelPinned ? rightSidebarWidth : 0
    const w = width - l - r - 42
    const h = height - tabsHeight - footerHeight - termControlHeight - (pinnedQuickCommandBar ? quickCommandBoxHeight : 0)
    if (layout === splitMap.c1) {
      return {
        wrapStyles: [
          {
            left: 0,
            top: 0,
            bottom: 0,
            right: 0
          }
        ],
        handleStyles: []
      }
    } else if (layout === splitMap.c2) {
      return {
        wrapStyles: [
          {
            left: 0,
            top: 0,
            bottom: 0,
            right: (w / 2 - 2) + 'px'
          },
          {
            left: (w / 2 + 2) + 'px',
            top: 0,
            bottom: 0,
            right: 0
          }
        ],
        handleStyles: [
          {
            left: (w / 2 - 2) + 'px',
            top: 0,
            bottom: 0
          }
        ]
      }
    } else if (layout === splitMap.c3) {
      return {
        wrapStyles: [
          {
            left: 0,
            top: 0,
            bottom: 0,
            right: (w / 3 - 2) + 'px'
          },
          {
            left: (w / 3 + 2) + 'px',
            top: 0,
            bottom: 0,
            right: (2 * w / 3 - 2) + 'px'
          },
          {
            left: (2 * w / 3 + 2) + 'px',
            top: 0,
            bottom: 0,
            right: 0
          }
        ],
        handleStyles: [
          {
            left: (w / 3 - 2) + 'px',
            top: 0,
            bottom: 0
          },
          {
            left: (2 * w / 3 + 2) + 'px',
            top: 0,
            bottom: 0
          }
        ]
      }
    }
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
