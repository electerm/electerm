/**
 * make child component resizable by drag the horizontal or vertical handle
 */

import {Component} from 'react'
//import ReactDOM from 'react-dom'
import PropTypes from 'prop-types'
import classnames from 'classnames'
import _ from 'lodash'
import {terminalSplitDirectionMap, minTerminalWidth, maxDragMove} from '../../common/constants'
import './resize-wrap.styl'

export default class ResizeWrap extends Component {

  static propTypes = {
    direction: PropTypes.oneOf(['horizontal', 'vertical']).isRequired,
    children: PropTypes.arrayOf(PropTypes.element).isRequired
  }

  // static defaultProps = {

  // }

  // componentDidMount() {
  //   //this.initDnD()
  // }

  onDrag = (e) => {
    let dom = e.target
    let prev = dom.previousSibling
    let next = dom.nextSibling
    let {direction} = this.props
    let {startPosition} = this
    if (_.isNull(e.pageX)) {
      return
    }
    let currentPosition = {
      x: e.pageX,
      y: e.pageY
    }

    let types = ['dom', 'prev', 'next']
    let doms = [dom, prev, next]
    let styles = doms.map(d => {
      let {style} = d
      let obj = _.pick(style, [
        'left',
        'top',
        'width',
        'height'
      ])
      return Object.keys(obj).reduce((prev, k) => {
        let v = obj[k]
        return {
          ...prev,
          [k]: _.isUndefined(v)
            ? v
            : parseInt(obj[k].replace('px', ''), 10)
        }
      }, {})
    })
    let xDiff = currentPosition.x - startPosition.x
    let yDiff = currentPosition.y - startPosition.y
    if (Math.abs(xDiff) > maxDragMove) {
      return
    }
    let prevStyle = styles[1]
    let nextStyle = styles[2]
    if (direction === terminalSplitDirectionMap.vertical) {
      if (yDiff > 0 && yDiff > nextStyle.height - minTerminalWidth) {
        yDiff = nextStyle.height - minTerminalWidth
      } else if (yDiff < 0 && yDiff < - (prevStyle.height - minTerminalWidth)) {
        yDiff = - (prevStyle.height - minTerminalWidth)
      }
    } else {
      if (xDiff > 0 && xDiff > nextStyle.width - minTerminalWidth) {
        xDiff = nextStyle.width - minTerminalWidth
      } else if (xDiff < 0 && xDiff < - (prevStyle.width - minTerminalWidth)) {
        xDiff = - (prevStyle.width - minTerminalWidth)
      }
    }
    doms.forEach((d, i) => {
      this.changePosition(d, direction, xDiff, yDiff, types[i], styles[i])
    })
    this.startPosition = currentPosition
  }

  onDragStart = (e) => {
    this.startPosition = {
      x: e.pageX,
      y: e.pageY
    }
  }

  changePosition = (
    dom,
    direction,
    xDiff,
    yDiff,
    type,
    style
  ) => {
    let realHeight = style.height
    let realWidth = style.width
    let realTop = style.top
    let realLeft = style.left
    if (type === 'prev' && direction === terminalSplitDirectionMap.vertical) {
      dom.style.height = (realHeight + yDiff) + 'px'
    } else if (type === 'prev') {
      dom.style.width = (realWidth + xDiff) + 'px'
    } else if (type === 'dom' && direction === terminalSplitDirectionMap.vertical) {
      dom.style.top = (realTop + yDiff) + 'px'
    } else if (type === 'dom') {
      dom.style.left = (realLeft + xDiff) + 'px'
    } else if (type === 'next' && direction === terminalSplitDirectionMap.vertical) {
      dom.style.top = (realTop + yDiff) + 'px'
      dom.style.height = (realHeight - yDiff) + 'px'
    } else {
      dom.style.width = (realWidth - xDiff) + 'px'
      dom.style.left = (realLeft + xDiff) + 'px'
    }
  }

  onDragEnd = () => {
    window.dispatchEvent(new CustomEvent('resize'))
  }

  onDoubleClick = () => {

  }

  buildHandleComponent = (prevComponent, direction, index) => {
    let zIndex = this.props.children.length + 10
    let cls = classnames(
      'term-dragger',
      `term-dragger-${index}`,
      `term-dragger-${direction}`
    )
    let {left, top, width, height} = prevComponent.props
    let style = direction === terminalSplitDirectionMap.vertical
      ? {
        left: 0,
        right: 0,
        zIndex,
        top: top + height - 2
      } : {
        top: 0,
        bottom: 0,
        zIndex,
        left: left + width - 2
      }
    let props = {
      style,
      ..._.pick(this, [
        'onDoubleClick',
        'onDrag',
        'onDragStart',
        'onDragEnd'
      ]),
      className: cls,
      draggable: true
    }
    return (
      <span
        {...props}
      />
    )
  }

  resizeComponent = (prevComponent) => {
    return prevComponent
  }

  render() {
    let {
      children,
      direction
    } = this.props
    let len = children.length
    if (len < 2) {
      return children
    }
    let newArr = children.reduce((prev, c, i) => {
      return [
        ...prev,
        c,
        i === len - 1
          ? null
          : this.buildHandleComponent(c, direction, i)
      ].filter(d => d)
    }, [])
    return newArr
  }
}
