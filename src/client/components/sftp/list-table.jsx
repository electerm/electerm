/**
 * file list table
 * features:
 * - drag to resize table
 * - context menu to set props to show
 * - click header to sort
 */

import React from 'react'
import classnames from 'classnames'
import _ from 'lodash'
import {generate} from 'shortid'
import {
  splitDraggerWidth,
  filePropMinWidth,
  maxDragMove,
  sftpControlHeight,
  contextMenuHeight,
  contextMenuPaddingTop,
  contextMenuWidth,
  eventTypes,
  paneMap
} from '../../common/constants'
import copy from 'json-deep-copy'
import {Icon} from 'antd'
import FileSection from './file'

const {prefix} = window
const e = prefix('sftp')

export default class FileListTable extends React.Component {

  constructor(props) {
    super(props)
    this.state = this.initFromProps()
  }

  componentDidMount() {
    this.saveOldStyle()
    window.addEventListener('message', this.onMsg)
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.state.properties.length < 2) {
      return
    }
    if (
      !_.isEqual(prevState.properties, this.state.properties) ||
      (
        this.toVisible(prevProps, this.props) &&
        !this.inited
      )
    ) {
      if (!this.inited) {
        this.inited = true
      }
      this.saveOldStyle()
    }
  }

  componentWillUnmount() {
    window.removeEventListener('message', this.onMsg)
  }

  toVisible = (prevProps, props) => {
    return (
      prevProps.pane === paneMap.ssh ||
      prevProps.pane === paneMap.terminal
    ) &&
    (
      props.pane === paneMap.sftp ||
      props.pane === paneMap.fileManager
    )
  }

  onMsg = e => {
    let {type, data} = e.data || {}
    if (
      type === eventTypes.resetFileListTable &&
      data.id === this.props.id
    ) {
      this.resetWidth()
    }
  }

  initFromProps = (pps = this.getPropsDefault()) => {
    let {length} = pps
    let {width} = this.props
    let padding = 5
    let w = (width - padding * 2) / length
    let properties = pps.map((name, i) => {
      return {
        name,
        id: generate(),
        style: {
          width: w + 'px',
          left: (w * i) + 'px',
          zIndex: 3 + i
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
            left: (w * (i + 1) - (splitDraggerWidth / 2)) + 'px',
            width: splitDraggerWidth + 'px'
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

  otherDirection = (direction) => {
    return direction === this.props.directions[0]
      ? this.props.directions[1]
      : this.props.directions[0]
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
        className="sftp-file-table-header relative"
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
    let {sortDirection, sortProp} = this.props
    let isSorting = !isHandle && sortProp === name
    let cls = classnames(
      'sftp-header-item',
      isHandle ? `shi-${id}` : `sftp-header-box shi-${name}`,
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
    let text = e(name || '')
    return (
      <div
        className={cls}
        style={style}
        id={id}
        key={id}
        draggable={isHandle}
        {...props}
        title={text}
      >
        {text}
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
    let {properties} = this.state
    let names = properties.map(d => d.name)
    let all = this.getPropsAll()
    let newProps = names.includes(name)
      ? names.filter(d => d!== name)
      : [...names, name]
    let props = all.filter(g => newProps.includes(g))
    let update = this.initFromProps(props)
    this.setState(update, this.onContextMenu)
  }

  onContextMenu = e => {
    e && e.preventDefault()
    let content = this.renderContext()
    let height = content.props.children.filter(_.identity)
      .length * contextMenuHeight + contextMenuPaddingTop * 2
    let pos = e
      ? this.computePos(e, height)
      : this.pos
    this.pos = pos
    this.props.openContextMenu({
      content,
      pos
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
    let {sortDirection, sortProp} = this.props
    let sortDirectionNew = sortProp === name
      ? this.otherDirection(sortDirection)
      : this.props.defaultDirection()
    let {type} = this.props
    this.props.modifier({
      [`sortDirection.${type}`]: sortDirectionNew,
      [`sortProp.${type}`]: name
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
                onClick={() => onClick(p)}
              >
                {
                  disabled || selected
                    ? <Icon type="check" className="mg1r" />
                    : <span className="icon-holder mg1r" />
                }
                {e(p)}
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

  saveOldStyle = () => {
    let {properties, splitHandles} = this.state
    let ids = [
      ...properties,
      ...splitHandles
    ]
    let {type, id} = this.props
    let parentWidth = document.querySelector(
      `#id-${id} .tw-${type} .sftp-table`
    ).clientWidth
    this.oldStyles = ids.reduce((prev, {id, name}) => {
      let sel = `.ssh-wrap-show .tw-${type} .sftp-file-table-header .shi-${name ? name : id}`
      return {
        ...prev,
        [name || id]: {
          style: _.pick(
            _.get(document.querySelector(sel), 'style') || {},
            this.positionProps
          ),
          parentWidth
        }
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
      let dd = _.isArray(d) ? d[0] : d
      let {style} = dd
      let rect = dd.getBoundingClientRect()
      let obj = _.pick(style, this.positionProps)
      let res = Object.keys(obj).reduce((prev, k) => {
        let v = obj[k]
        return {
          ...prev,
          [k]: _.isUndefined(v)
            ? v
            : parseInt(obj[k].replace('px', ''), 10)
        }
      }, {})
      res.width = rect.right - rect.left
      return res
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

  // onDragEnd = () => {}

  onDoubleClick = () => this.resetWidth()

  rebuildStyle = (name) => {
    let {style, parentWidth} = this.oldStyles[name]
    style = copy(style)
    let {
      type,
      id
    } = this.props
    let currentParentWidth = document.querySelector(
      `#id-${id} .tw-${type} .sftp-table`
    ).clientWidth
    style.width = (parseFloat(style.width) * currentParentWidth / parentWidth) + 'px'
    style.left = (parseFloat(style.left) * currentParentWidth / parentWidth) + 'px'
    return style
  }

  //reset
  resetWidth = () => {
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
          this.rebuildStyle(
            name || id
          )
        )
      })
    })
  }

  renderItem = (item, i) => {
    let {type} = this.props
    return (
      <FileSection
        {...this.props.getFileProps(item, type)}
        key={i + '*f*' + item.id}
        properties={this.state.properties}
      />
    )
  }

  render() {
    let {fileList, height, type} = this.props
    const tableHeaderHeight = 30
    return (
      <div className="sftp-table relative">
        {this.renderTableHeader()}
        <div
          className="sftp-table-content overscroll-y relative"
          style={{
            height: height - sftpControlHeight - tableHeaderHeight
          }}
          draggable={false}
        >
          {this.props.renderEmptyFile(type)}
          {
            fileList.map(this.renderItem)
          }
        </div>
      </div>
    )
  }
}
