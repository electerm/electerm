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
import {
  splitDraggerWidth,
  filePropMinWidth,
  maxDragMove,
  contextMenuHeight,
  contextMenuPaddingTop,
  contextMenuWidth
} from '../../common/constants'
import {Icon} from 'antd'
import FileSection from './file'

export default class ResizeWrap extends Component {

  constructor(props) {
    super(props)
    this.state = {
      sortProp: 'modifyTime',
      sortDirection: this.defaultDirection(),
      ...this.initFromProps()
    }
  }

  initFromProps = (pps = this.getPropsDefault()) => {
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
    let splitHandles = properties.reduce((prev, {name}, i) => {
      if (i === length - 1) {
        return prev
      }
      return [
        ...prev,
        {
          id: generate(),
          prevProp: name,
          nextProp: properties[i + 1].name,
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

  directions = [
    'desc',
    'asc'
  ]

  defaultDirection = () => {
    return this.directions[0]
  }

  otherDirection = (direction) => {
    return direction === this.directions[0]
      ? this.directions[1]
      : this.directions[0]
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
      <div
        className="sftp-file-table-header"
        onContextMenu={this.onContextMenu}
      >
        {
          arr.map(this.renderHeaderItem)
        }
      </div>
    )
  }

  renderHeaderItem = (item) => {
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
      isHandle ? `shi-${id}` : `shi-${name}`,
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
      : {
        onClick: this.onClickName
      }
    return (
      <div
        className={cls}
        style={style}
        id={id}
        key={id}
        draggable={isHandle}
        {...props}
      >
        {name || ''}
      </div>
    )
  }

  computePos = (e, height, ) => {
    let {clientX, clientY} = e
    let res = {
      left: clientX,
      top: clientY
    }
    if (window.innerHeight < res.top + height + 10) {
      res.top = res.top - height
    }
    if (window.innerWidth < res.left + contextMenuWidth + 10) {
      res.left = res.left - contextMenuWidth
    }
    res.top = res.top > 0 ? res.top : 0
    return res
  }

  onToggleProp = name => {
    let properties = this.state
    let names = properties.map(d => d.name)
    let all = this.getPropsAll()
    let newProps = names.includes(name)
      ? names.filter(d => d!== name)
      : [...names, name]
    let props = all.filter(g => newProps.includes(g))
    let update = this.initFromProps(props)
    this.setState(update)
  }

  onContextMenu = e => {
    e.preventDefault()
    let content = this.renderContext()
    let height = content.props.children.filter(_.identity)
      .length * contextMenuHeight + contextMenuPaddingTop * 2
    this.props.openContextMenu({
      content,
      pos: this.computePos(e, height)
    })
  }

  onClickName = (e) => {
    let id = e.target.getAttribute('id')
    let {properties} = this.state
    let propObj = _.find(
      properties,
      p => p.id === id
    )
    if (!propObj) {
      return
    }
    let {name} = propObj
    let {sortDirection, sortProp} = this.state
    let sortDirectionNew = sortProp === name
      ? this.otherDirection(sortDirection)
      : this.defaultDirection()
    this.setState({
      sortDirection: sortDirectionNew,
      sortProp: name
    })
  }

  renderContext = () => {
    let clsBase = 'pd2x pd1y context-item pointer'
    let {properties} = this.state
    let all = this.getPropsAll()
    let selectedNames = properties.map(d => d.name)
    return (
      <div>
        {
          all.map((p, i) => {
            let selected = selectedNames.includes(p)
            let disabled = !i
            let cls = classnames(
              clsBase,
              {selected},
              {unselected: !selected},
              {disabled}
            )
            let onClick = disabled
              ? _.noop
              : this.onToggleProp
            return (
              <div
                className={cls}
                onClick={() => onClick(name)}
              >
                {
                  disabled || selected
                    ? <Icon type="check" className="mg1r" />
                    : <span className="icon-holder mg1r" />
                }
                {name}
              </div>
            )
          })
        }
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
    let {type} = this.props
    this.oldStyles = ids.reduce((prev, {id, name}) => {
      let sel = `.ssh-wrap-show .tw-${type} .sftp-file-table-header .shi-${name ? name : id}`
      return {
        ...prev,
        [name || id]: _.pick(
          document.querySelector(sel).style,
          this.positionProps
        )
      }
    }, {})
  }

  onDrag = (e) => {
    if (_.isNull(e.pageX)) {
      return
    }
    let dom = e.target
    let {splitHandles} = this.state
    let {type} = this.props
    let id = dom.getAttribute('id')
    let splitHandle = _.find(
      splitHandles,
      s => s.id === id
    )
    let {
      prevProp,
      nextProp
    } = splitHandle
    let selPrev = `.ssh-wrap-show .tw-${type} .shi-${prevProp}`
    let selNext = `.ssh-wrap-show .tw-${type} .shi-${nextProp}`
    let prev = Array.from(document.querySelectorAll(selPrev))
    let next = Array.from(document.querySelectorAll(selNext))
    let {startPosition} = this
    let currentPosition = {
      x: e.pageX
    }

    let types = ['dom', 'prev', 'next']
    let doms = [dom, prev, next]
    let styles = doms.map(d => {
      let {style} = _.isArray(d) ? d[0] : d
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
      this.changePosition(d, xDiff, types[i], styles[i])
    })
    this.startPosition = currentPosition
  }

  onDragStart = (e) => {
    this.startPosition = {
      x: e.pageX
    }
  }

  changePosition = (
    dom,
    xDiff,
    type,
    style
  ) => {
    let realWidth = style.width
    let realLeft = style.left
    if (type === 'prev') {
      dom.forEach(d => {
        d.style.width = (realWidth + xDiff) + 'px'
      })
    } else if (type === 'dom') {
      dom.style.left = (realLeft + xDiff) + 'px'
    } else {
      dom.forEach(d => {
        d.style.width = (realWidth - xDiff) + 'px'
        d.style.left = (realLeft + xDiff) + 'px'
      })
    }
  }

  //onDragEnd = () => {}

  //reset
  onDoubleClick = () => {
    let {properties, splitHandles} = this.state
    let ids = [
      ...properties,
      ...splitHandles
    ]
    let {type} = this.props
    ids.forEach(({id, name}) => {
      let sel = `.ssh-wrap-show .tw-${type} .shi-${name ? name : id}`
      let arr = Array.from(
        document.querySelectorAll(sel)
      )
      arr.forEach(d => {
        Object.assign(
          d.style,
          this.oldStyles[name || id] || {}
        )
      })
    })
  }

  renderItem = (item, i) => {
    let {type} = this.props
    return (
      <FileSection
        {...this.props.getFileProps(item, type)}
        key={i + 'itd' + name}
      />
    )
  }

  render() {
    let {list} = this.props
    return (
      <div className="sftp-table">
        {this.renderTableHeader()}
        {
          list.map(this.renderItem)
        }
      </div>
    )
  }
}
