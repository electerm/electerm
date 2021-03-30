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
import { nanoid as generate } from 'nanoid/non-secure'
import {
  splitDraggerWidth,
  filePropMinWidth,
  maxDragMove,
  sftpControlHeight,
  eventTypes,
  paneMap
} from '../../common/constants'
import copy from 'json-deep-copy'
import { CheckOutlined } from '@ant-design/icons'
import FileSection from './file-item'

const { prefix } = window
const e = prefix('sftp')

export default class FileListTable extends React.Component {
  constructor (props) {
    super(props)
    this.state = this.initFromProps()
  }

  componentDidMount () {
    this.saveOldStyle()
    window.addEventListener('message', this.onMsg)
  }

  componentDidUpdate (prevProps, prevState) {
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

  componentWillUnmount () {
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
    const { type, data } = e.data || {}
    if (
      type === eventTypes.resetFileListTable &&
      data.id === this.props.id
    ) {
      this.resetWidth()
    }
  }

  initFromProps = (pps = this.getPropsDefault()) => {
    const { length } = pps
    const { width } = this.props
    const padding = 5
    const w = (width - padding * 2) / length
    const properties = pps.map((name, i) => {
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
    const splitHandles = properties.reduce((prev, { name }, i) => {
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
      'owner',
      'group',
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
    const { properties, splitHandles } = this.state
    const arr = properties.reduce((prev, p, i) => {
      return [
        ...prev,
        p,
        splitHandles[i]
      ]
    }, []).filter(d => d)
    return (
      <div
        className='sftp-file-table-header relative'
        onContextMenu={this.onContextMenu}
      >
        {
          arr.map(this.renderHeaderItem)
        }
      </div>
    )
  }

  renderHeaderItem = (item) => {
    const {
      name,
      id,
      style
    } = item
    const isHandle = !name
    const { sortDirection, sortProp } = this.props
    const isSorting = !isHandle && sortProp === name
    const cls = classnames(
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
    const props = isHandle
      ? _.pick(this, [
        'onDoubleClick',
        'onDrag',
        'onDragStart',
        'onDragEnd'
      ])
      : {
        onClick: this.onClickName
      }
    const text = e(name || '')
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

  computePos = (e, height) => {
    return {
      left: e.clientX,
      top: e.clientY
    }
  }

  onToggleProp = name => {
    const { properties } = this.state
    const names = properties.map(d => d.name)
    const all = this.getPropsAll()
    const newProps = names.includes(name)
      ? names.filter(d => d !== name)
      : [...names, name]
    const props = all.filter(g => newProps.includes(g))
    const update = this.initFromProps(props)
    this.setState(update, this.onContextMenu)
  }

  onContextMenu = e => {
    e && e.preventDefault()
    const content = this.renderContext()
    const pos = e
      ? this.computePos(e)
      : this.pos
    this.pos = pos
    this.props.store.openContextMenu({
      content,
      pos
    })
  }

  onClickName = (e) => {
    const id = e.target.getAttribute('id')
    const { properties } = this.state
    const propObj = _.find(
      properties,
      p => p.id === id
    )
    if (!propObj) {
      return
    }
    const { name } = propObj
    const { sortDirection, sortProp } = this.props
    const sortDirectionNew = sortProp === name
      ? this.otherDirection(sortDirection)
      : this.props.defaultDirection()
    const { type } = this.props
    this.props.modifier({
      [`sortDirection.${type}`]: sortDirectionNew,
      [`sortProp.${type}`]: name
    })
  }

  renderContext = () => {
    const clsBase = 'pd2x pd1y context-item pointer'
    const { properties } = this.state
    const all = this.getPropsAll()
    const selectedNames = properties.map(d => d.name)
    return (
      <div>
        {
          all.map((p, i) => {
            const selected = selectedNames.includes(p)
            const disabled = !i
            const cls = classnames(
              clsBase,
              { selected },
              { unselected: !selected },
              { disabled }
            )
            const onClick = disabled
              ? _.noop
              : this.onToggleProp
            return (
              <div
                className={cls}
                onClick={() => onClick(p)}
              >
                {
                  disabled || selected
                    ? <CheckOutlined className='mg1r' />
                    : <span className='icon-holder mg1r' />
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
    const { properties, splitHandles } = this.state
    const ids = [
      ...properties,
      ...splitHandles
    ]
    const { type, id } = this.props
    const parentWidth = document.querySelector(
      `#id-${id} .tw-${type} .sftp-table`
    ).clientWidth
    this.oldStyles = ids.reduce((prev, { id, name }) => {
      const sel = `.ssh-wrap-show .tw-${type} .sftp-file-table-header .shi-${name || id}`
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
    const dom = e.target
    const { splitHandles } = this.state
    const { type } = this.props
    const id = dom.getAttribute('id')
    const splitHandle = _.find(
      splitHandles,
      s => s.id === id
    )
    const {
      prevProp,
      nextProp
    } = splitHandle
    const selPrev = `.ssh-wrap-show .tw-${type} .shi-${prevProp}`
    const selNext = `.ssh-wrap-show .tw-${type} .shi-${nextProp}`
    const prev = Array.from(document.querySelectorAll(selPrev))
    const next = Array.from(document.querySelectorAll(selNext))
    const { startPosition } = this
    const currentPosition = {
      x: e.pageX
    }

    const types = ['dom', 'prev', 'next']
    const doms = [dom, prev, next]
    const styles = doms.map(d => {
      const dd = _.isArray(d) ? d[0] : d
      const { style } = dd
      const rect = dd.getBoundingClientRect()
      const obj = _.pick(style, this.positionProps)
      const res = Object.keys(obj).reduce((prev, k) => {
        const v = obj[k]
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
    const prevStyle = styles[1]
    const nextStyle = styles[2]
    const minW = filePropMinWidth
    if (xDiff > 0 && xDiff > nextStyle.width - minW) {
      xDiff = nextStyle.width - minW
    } else if (xDiff < 0 && xDiff < -(prevStyle.width - minW)) {
      xDiff = -(prevStyle.width - minW)
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
    const realWidth = style.width
    const realLeft = style.left
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
    let { style, parentWidth } = this.oldStyles[name]
    style = copy(style)
    const {
      type,
      id
    } = this.props
    const currentParentWidth = document.querySelector(
      `#id-${id} .tw-${type} .sftp-table`
    ).clientWidth
    style.width = (parseFloat(style.width) * currentParentWidth / parentWidth) + 'px'
    style.left = (parseFloat(style.left) * currentParentWidth / parentWidth) + 'px'
    return style
  }

  // reset
  resetWidth = () => {
    const { properties, splitHandles } = this.state
    const ids = [
      ...properties,
      ...splitHandles
    ]
    const { type } = this.props
    ids.forEach(({ id, name }) => {
      const sel = `.ssh-wrap-show .tw-${type} .shi-${name || id}`
      const arr = Array.from(
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
    const { type } = this.props
    return (
      <FileSection
        {...this.props.getFileProps(item, type)}
        key={i + '*f*' + item.id}
        cls='real-file-item'
        properties={this.state.properties}
      />
    )
  }

  render () {
    const { fileList, height, type } = this.props
    const tableHeaderHeight = 30
    return (
      <div className='sftp-table relative'>
        {this.renderTableHeader()}
        <div
          className='sftp-table-content overscroll-y relative'
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
