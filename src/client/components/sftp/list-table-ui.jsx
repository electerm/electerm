/**
 * file list table
 */

import { Component } from 'react'
import { Dropdown } from 'antd'
import classnames from 'classnames'
import FileSection from './file-item'
import PagedList from './paged-list'
import FileListTableHeader from './file-table-header'
import {
  CheckOutlined
} from '@ant-design/icons'
import IconHolder from '../sys-menu/icon-holder'
import { filesRef } from '../common/ref'

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
    const propObj = properties.find(
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

  // reset
  resetWidth = () => {
    this.setState(this.initFromProps())
  }

  setClickFileId = (id) => {
    this.currentFileId = id
  }

  renderItem = (item) => {
    const { type } = this.props
    const cls = item.isParent ? 'parent-file-item' : 'real-file-item'
    const key = item.id
    const fileProps = {
      ...this.props.getFileProps(item, type),
      cls,
      properties: this.state.properties,
      setClickFileId: this.setClickFileId
    }
    return (
      <FileSection
        {...fileProps}
        key={key}
      />
    )
  }

  onContextMenu = ({ key }) => {
    this.onToggleProp(key)
  }

  handleClick = (e) => {
    const target = e.target.closest('[data-id]')
    if (target) {
      const id = target.getAttribute('data-id')
      const refKey = 'file-' + id
      const ref = filesRef.get(refKey)
      if (ref) {
        ref.onClick(e)
      }
    }
  }

  handleDoubleClick = (e) => {
    const target = e.target.closest('[data-id]')
    if (target) {
      const id = target.getAttribute('data-id')
      const ref = filesRef.get('file-' + id)
      if (ref) {
        ref.transferOrEnterDirectory(e)
      }
    }
  }

  getClickedFile = () => {
    const refKey = this.currentFileId
    return filesRef.get(refKey)
  }

  handleDropdownOpenChange = (open) => {
    if (open) {
      this.forceUpdate()
    }
  }

  onContextMenuFile = ({ key }) => {
    if (key !== 'more-submenu') {
      const inst = this.getClickedFile()
      if (inst) {
        inst[key]()
      }
    }
  }

  renderContextMenuFile = () => {
    const fileInst = this.getClickedFile()
    return fileInst ? fileInst.renderContextMenu() : []
  }

  renderParent = (type) => {
    const { parentItem } = this.props
    return parentItem
      ? this.renderItem(parentItem)
      : null
  }

  render () {
    const { fileList, height, type } = this.props
    // const tableHeaderHeight = 30
    // const sh = sshSftpSplitView ? 0 : 32
    const props = {
      className: 'sftp-table-content overscroll-y relative',
      style: {
        height: height - 42 - 30 - 32 - 90
      },
      draggable: false,
      onClick: this.handleClick,
      onDoubleClick: this.handleDoubleClick
    }
    const hasPager = this.hasPager()
    const cls = classnames(
      'sftp-table relative',
      {
        'sftp-has-pager': hasPager
      }
    )
    const ddProps = {
      menu: {
        items: this.renderContextMenuFile(),
        onClick: this.onContextMenuFile
      },
      trigger: ['contextMenu'],
      onOpenChange: this.handleDropdownOpenChange
    }
    return (
      <div className={cls}>
        {this.renderTableHeader()}
        <Dropdown {...ddProps}>
          <div
            {...props}
          >
            {
                this.props.renderEmptyFile(
                  type,
                  {
                    setClickFileId: this.setClickFileId
                  }
                )
            }
            {this.renderParent(type)}
            <PagedList
              list={fileList}
              renderItem={this.renderItem}
              hasPager={hasPager}
            />
          </div>
        </Dropdown>
      </div>
    )
  }
}
