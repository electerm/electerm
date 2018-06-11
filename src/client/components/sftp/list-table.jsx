/**
 * file list table
 * features:
 * - drag to resize table
 * - context menu to set props to show
 * - click header to sort
 */

/**
 * make child component resizable by drag the horizontal or vertical handle
 */

import {Component} from 'react'
import classnames from 'classnames'
import _ from 'lodash'
import {generate} from 'shortid'
import {splitDraggerWidth, filePropMinWidth, maxDragMove} from '../../common/constants'

export default class ResizeWrap extends Component {

  constructor(props) {
    super(props)
    this.state = {
      sortProp: 'modifyTime',
      sortDirection: 'desc',
      ...this.initFromProps()
    }
  }

  initFromProps = () => {
    let pps = this.getPropsDefault()
    let {width, length} = pps
    let w = width / length
    let properties = pps.map((name, i) => {
      return {
        name,
        id: generate(),
        style: {
          width: w,
          left: w * i
        }
      }
    })
    let splitHandles = properties.reduce((prev, name, i) => {
      if (i === length - 1) {
        return prev
      }
      return [
        ...prev,
        {
          id: generate(),
          style: {
            left: w * (i + 1) - (splitDraggerWidth / 2),
            width: splitDraggerWidth
          }
        }
      ]
    }, [])
    return {
      properties,
      splitHandles
    }
  }

  getPropsDefault = () => {
    return [
      'name',
      'size',
      'modifyTime'
    ]
  }

  getPropsAll = () => {
    return [
      'name',
      'size',
      'modifyTime',
      'accessTime',
      'mode',
      'path'
    ]
  }

  renderTableHeader = () => {
    let {properties, splitHandles} = this.state
    let arr = properties.reduce((prev, p, i) => {
      return [
        ...prev,
        p,
        splitHandles[i]
      ]
    }, []).filter(d => d)
    return (
      <div className="sftp-file-table-header">
        {
          arr.map(this.renderHeaderItem)
        }
      </div>
    )
  }

  renderHeaderItem = (item, i) => {
    let {
      name,
      id,
      style
    } = item
    let isHandle = !name
    let {sortDirection, sortProp} = this.state
    let isSorting = !isHandle && sortProp === name
    let cls = classnames(
      'sftp-header-item',
      `shi-${id}`,
      {
        'sftp-header-handle': isHandle
      },
      {
        'sftp-header-name': !isHandle
      },
      {
        'is-sorting': isSorting
      },
      isSorting ? sortDirection : ''
    )
    let props = isHandle
      ? _.pick(this, [
        'onDoubleClick',
        'onDrag',
        'onDragStart',
        'onDragEnd'
      ])
      : _.pick(this, [
        'onClickName'
      ])
    return (
      <div
        className={cls}
        style={style}
        draggable={isHandle}
        {...props}
      >
        {name || ''}
      </div>
    )
  }

  positionProps = [
    'width',
    'left'
  ]

  saveOldStyle() {
    let {properties, splitHandles} = this.state
    let ids = [
      ...properties,
      ...splitHandles
    ]
    this.oldStyles = ids.reduce((prev, {id}) => {
      return {
        ...prev,
        [id]: _.pick(
          document.querySelector(`.shi-${id}`).style,
          this.positionProps
        )
      }
    }, {})
  }

  onDrag = (e) => {
    let dom = e.target
    let prev = dom.previousSibling
    let next = dom.nextSibling
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
    let minW = filePropMinWidth
    if (xDiff > 0 && xDiff > nextStyle.width - minW) {
      xDiff = nextStyle.width - minW
    } else if (xDiff < 0 && xDiff < - (prevStyle.width - minW)) {
      xDiff = - (prevStyle.width - minW)
    }
    doms.forEach((d, i) => {
      this.changePosition(d, xDiff, yDiff, types[i], styles[i])
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
    xDiff,
    yDiff,
    type,
    style
  ) => {
    let realWidth = style.width
    let realLeft = style.left
    if (type === 'prev') {
      dom.style.width = (realWidth + xDiff) + 'px'
    } else if (type === 'dom') {
      dom.style.left = (realLeft + xDiff) + 'px'
    } else {
      dom.style.width = (realWidth - xDiff) + 'px'
      dom.style.left = (realLeft + xDiff) + 'px'
    }
  }

  //onDragEnd = () => {}

  //reset
  onDoubleClick = () => {
    let {childIds, splitIds} = this.state
    let ids = [
      ...splitIds,
      ...childIds
    ]
    ids.forEach((id) => {
      Object.assign(
        document.querySelector(`.shi-${id}`).style,
        this.oldStyles[id]
      )
    })
  }

  render() {
    return null
  }
}
