/**
 * file list table
 */

import { Component } from 'react'
import classnames from 'classnames'
import { find } from 'lodash-es'
import {
  sftpControlHeight
} from '../../common/constants'
import FileSection from './file-item'
import PagedList from './paged-list'
import FileListTableHeader from './file-table-header'
import {
  CheckOutlined
} from '@ant-design/icons'
import IconHolder from '../sys-menu/icon-holder'

const e = window.translate

export default class FileListTable extends Component {
  constructor (props) {
    super(props)
    this.state = this.initFromProps()
  }

  initFromProps = (pps = this.getPropsDefault()) => {
    const { length } = pps
    const size = (100 / length)
    const max = (100 - length * 2)
    const min = 2
    const properties = pps.map((name, i) => {
      return {
        id: name,
        max,
        min,
        size
      }
    })
    return {
      pageSize: 100,
      properties
    }
  }

  getPropsDefault = () => {
    return this.props.config.filePropsEnabled || [
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
      'path',
      'ext'
    ]
  }

  otherDirection = (direction) => {
    return direction === this.props.directions[0]
      ? this.props.directions[1]
      : this.props.directions[0]
  }

  onResize = size => {
    this.setState(old => {
      const { properties } = old
      const total = size.reduce((a, b) => a + b, 0)
      const newProps = properties.map((d, i) => {
        return {
          ...d,
          size: size[i] * 100 / total
        }
      })
      return {
        properties: newProps
      }
    })
  }

  renderTableHeader = () => {
    const headerProps = {
      renderContextMenu: this.renderContextMenu,
      onContextMenu: this.onContextMenu,
      onClickName: this.onClickName,
      onResize: this.onResize,
      properties: this.state.properties,
      sortDirection: this.props.sortDirection,
      sortProp: this.props.sortProp,
      maxWidth: this.props.width
    }
    return (
      <FileListTableHeader {...headerProps} />
    )
  }

  computePos = (e, height) => {
    return e.target.getBoundingClientRect()
  }

  onToggleProp = name => {
    const { properties } = this.state
    const names = properties.map(d => d.id)
    const all = this.getPropsAll()
    const newProps = names.includes(name)
      ? names.filter(d => d !== name)
      : [...names, name]
    const props = all.filter(g => newProps.includes(g))
    const update = this.initFromProps(props)
    window.store.setConfig({
      filePropsEnabled: props
    })
    this.setState(update)
  }

  onClickName = (e) => {
    const id = e.target.getAttribute('data-id')
    const { properties } = this.state
    const propObj = find(
      properties,
      p => p.id === id
    )
    if (!propObj) {
      return
    }
    const { id: name } = propObj
    const { sortDirection, sortProp } = this.props
    const sortDirectionNew = sortProp === name
      ? this.otherDirection(sortDirection)
      : this.props.defaultDirection()
    const { type } = this.props
    window.store.setSftpSortSetting({
      [type]: {
        direction: sortDirectionNew,
        prop: name
      }
    })

    this.props.modifier({
      [`sortDirection.${type}`]: sortDirectionNew,
      [`sortProp.${type}`]: name
    })
  }

  renderContextMenu = () => {
    const { properties } = this.state
    const all = this.getPropsAll()
    const selectedNames = properties.map(d => d.id)
    return all.map((p, i) => {
      const selected = selectedNames.includes(p)
      const disabled = !i
      const icon = disabled || selected ? <CheckOutlined /> : <IconHolder />
      return {
        key: p,
        label: e(p),
        disabled,
        icon
      }
    })
  }

  positionProps = [
    'width',
    'left'
  ]

  // saveOldStyle = () => {
  //   const { properties } = this.state
  //   const ids = [
  //     ...properties,
  //     ...splitHandles
  //   ]
  //   const { type, id } = this.props
  //   const parentWidth = document.querySelector(
  //     `#id-${id} .tw-${type} .sftp-table`
  //   ).clientWidth
  //   this.oldStyles = ids.reduce((prev, { id, name }) => {
  //     const sel = `.session-current .tw-${type} .sftp-file-table-header .shi-${name || id}`
  //     return {
  //       ...prev,
  //       [name || id]: {
  //         style: pick(
  //           document.querySelector(sel)?.style || {},
  //           this.positionProps
  //         ),
  //         parentWidth
  //       }
  //     }
  //   }, {})
  // }

  // changePosition = (
  //   dom,
  //   xDiff,
  //   type,
  //   style
  // ) => {
  //   const realWidth = style.width
  //   const realLeft = style.left
  //   if (type === 'prev') {
  //     dom.forEach(d => {
  //       d.style.width = (realWidth + xDiff) + 'px'
  //     })
  //   } else if (type === 'dom') {
  //     dom.style.left = (realLeft + xDiff) + 'px'
  //   } else {
  //     dom.forEach(d => {
  //       d.style.width = (realWidth - xDiff) + 'px'
  //       d.style.left = (realLeft + xDiff) + 'px'
  //     })
  //   }
  // }

  // onDragEnd = () => {}

  // onDoubleClick = () => this.resetWidth()

  hasPager = () => {
    const {
      pageSize
    } = this.state
    const {
      fileList
    } = this.props
    const len = fileList.length
    return len > pageSize
  }

  // rebuildStyle = (name) => {
  //   let { style, parentWidth } = this.oldStyles[name]
  //   style = copy(style)
  //   const {
  //     type,
  //     id
  //   } = this.props
  //   const currentParentWidth = document.querySelector(
  //     `#id-${id} .tw-${type} .sftp-table`
  //   ).clientWidth
  //   style.width = (parseFloat(style.width) * currentParentWidth / parentWidth) + 'px'
  //   style.left = (parseFloat(style.left) * currentParentWidth / parentWidth) + 'px'
  //   return style
  // }

  // reset
  resetWidth = () => {
    this.setState(this.initFromProps())
  }

  renderItem = (item, i) => {
    const { type } = this.props
    const cls = item.isParent ? 'parent-file-item' : 'real-file-item'
    const key = i + '*f*' + item.id
    return (
      <FileSection
        {...this.props.getFileProps(item, type)}
        key={key}
        cls={cls}
        properties={this.state.properties}
      />
    )
  }

  onContextMenu = ({ key }) => {
    this.onToggleProp(key)
  }

  renderParent = (type) => {
    const { parentItem } = this.props
    return parentItem ? this.renderItem(parentItem) : null
  }

  render () {
    const { fileList, height, type } = this.props
    const tableHeaderHeight = 30
    const props = {
      className: 'sftp-table-content overscroll-y relative',
      style: {
        height: height - sftpControlHeight - tableHeaderHeight
      },
      draggable: false
    }
    const hasPager = this.hasPager()
    const cls = classnames(
      'sftp-table relative',
      {
        'sftp-has-pager': hasPager
      }
    )

    return (
      <div className={cls}>
        {this.renderTableHeader()}
        <div
          {...props}
        >
          {this.props.renderEmptyFile(type)}
          {this.renderParent(type)}
          <PagedList
            list={fileList}
            renderItem={this.renderItem}
            hasPager={hasPager}
          />
        </div>
      </div>
    )
  }
}
