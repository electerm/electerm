/**
 * context menu
 */
import React from 'react'
import ReactDOM from 'react-dom'
import PropTypes from 'prop-types'
import './context-menu.styl'
import findParent from '../../common/find-parent'
import classnames from 'classnames'
import {
  contextMenuHeight,
  contextMenuPaddingTop,
  contextMenuWidth,
  topMenuHeight
} from '../../common/constants'
import _ from 'lodash'

export default class ContextMenu extends React.PureComponent {
  static propTypes = {
    content: PropTypes.element.isRequired,
    visible: PropTypes.bool,
    pos: PropTypes.object,
    className: PropTypes.string,
    closeContextMenu: PropTypes.func
  }

  static defaultProps = {
    content: <div />,
    visible: false,
    pos: {
      left: 0,
      top: 0
    },
    className: 'context-menu'
  }

  componentDidMount () {
    ReactDOM.findDOMNode(this)
      .addEventListener('click', e => {
        const { target } = e
        const p = findParent(target, '.context-item')
        if (
          p &&
          !p.classList.contains('no-auto-close-context') &&
          !p.classList.contains('disabled')
        ) {
          this.props.closeContextMenu()
        }
      })
    window.addEventListener('message', e => {
      if (e.data && e.data.type && e.data.type === 'close-context-menu') {
        this.props.closeContextMenu()
      }
    })
  }

  computePos = () => {
    const count = this.props.content.props.children
      ? this.props.content.props.children.filter(c => _.identity(c) && c.type !== 'hr').length
      : 3
    const countHr = this.props.content.props.children
      ? this.props.content.props.children.filter(c => _.identity(c) && c.type === 'hr').length
      : 3
    // const { clientX, clientY } = e
    // const res = {
    //   left: clientX,
    //   top: clientY
    // }
    // if (window.innerHeight < res.top + height + 10) {
    //   res.top = res.top - height
    // }
    // if (window.innerWidth < res.left + contextMenuWidth + 10) {
    //   res.left = res.left - contextMenuWidth
    // }
    // res.top = res.top > 0 ? res.top : 0
    // return res
    let {
      left,
      top
    } = this.props.pos
    const height = count * contextMenuHeight + contextMenuPaddingTop * 2 + countHr * 1
    const maxHeight = Math.max(
      window.innerHeight - topMenuHeight - top,
      top - topMenuHeight
    )
    const shouldScroll = maxHeight < height
    const startTop = top > (window.innerHeight - topMenuHeight) / 2
    const realHeight = Math.min(maxHeight, height)
    if (startTop) {
      top = top - realHeight
    }
    if (window.innerWidth < left + contextMenuWidth + 10) {
      left = left - contextMenuWidth
    }
    return {
      pos: {
        left: left + 'px',
        top: top + 'px',
        height: realHeight + 'px'
      },
      realHeight,
      shouldScroll
    }
  }

  render () {
    const { visible, content, className } = this.props
    const {
      pos,
      shouldScroll,
      realHeight
    } = this.computePos()
    const cls = classnames(
      className,
      visible ? 'show' : 'hide',
      shouldScroll ? 'scroll' : ''
    )
    return (
      <div
        className={cls}
        style={pos}
      >
        <div
          className='context-menu-inner'
          style={{
            height: (realHeight - contextMenuPaddingTop * 2) + 'px'
          }}
        >
          {content}
        </div>
      </div>
    )
  }
}
