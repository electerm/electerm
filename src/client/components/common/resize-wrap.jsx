/**
 * make child component resizable by drag the horizontal or vertical handle
 */

import React from 'react'
import PropTypes from 'prop-types'
import classnames from 'classnames'
import _ from 'lodash'
import {generate} from 'shortid'
import memoizeOne from 'memoize-one'
import {
  terminalSplitDirectionMap,
  minTerminalWidth,
  maxDragMove
} from '../../common/constants'
import './resize-wrap.styl'

export default class ResizeWrap extends React.PureComponent {

  static propTypes = {
    direction: PropTypes.oneOf(['horizontal', 'vertical']).isRequired,
    children: PropTypes.arrayOf(PropTypes.element).isRequired,
    minWidth: PropTypes.number,
    onEndDrag: PropTypes.func,
    noResizeEvent: PropTypes.bool
  }

  getChildIds = (props = this.props) => {
    return props.children.map(c => c.props.id)
  }

  getSplitIds = () => {
    let len = this.props.children.length - 1
    return this.getSplitIdsCache(len)
  }

  getSplitIdsCache = memoizeOne((len) => {
    return new Array(len)
      .fill(8).map(() => generate())
  })

  positionProps = [
    'width',
    'height',
    'left',
    'top'
  ]

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
      let obj = _.pick(style, this.positionProps)
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
    let minW = this.props.minWidth || minTerminalWidth
    if (direction === terminalSplitDirectionMap.vertical) {
      if (yDiff > 0 && yDiff > nextStyle.height - minW) {
        yDiff = nextStyle.height - minW
      } else if (yDiff < 0 && yDiff < - (prevStyle.height - minW)) {
        yDiff = - (prevStyle.height - minW)
      }
    } else {
      if (xDiff > 0 && xDiff > nextStyle.width - minW) {
        xDiff = nextStyle.width - minW
      } else if (xDiff < 0 && xDiff < - (prevStyle.width - minW)) {
        xDiff = - (prevStyle.width - minW)
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
    let {
      noResizeEvent,
      onDragEnd
    } = this.props
    if (onDragEnd) {
      onDragEnd()
    }
    if (noResizeEvent) {
      return
    }
    window.dispatchEvent(new CustomEvent('resize'))
  }


  buildHandleComponent = (prevComponent, direction, index, tid) => {
    let zIndex = this.props.children.length + 10
    let cls = classnames(
      `tw-${tid}`,
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
        key={tid}
        {...props}
      />
    )
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
    let splitIndex = 0
    let splitIds = this.getSplitIds()
    let newArr = children.reduce((prev, c, i) => {
      let split = null
      if (i !== len - 1) {
        split = this.buildHandleComponent(c, direction, i, splitIds[splitIndex])
        splitIndex ++
      }
      return [
        ...prev,
        c,
        split
      ].filter(d => d)
    }, [])
    return newArr
  }
}
