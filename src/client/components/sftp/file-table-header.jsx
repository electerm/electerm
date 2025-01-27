/**
 * file list table
 */

import { Component } from 'react'
import classnames from 'classnames'
import {
  DownOutlined,
  UpOutlined
} from '@ant-design/icons'
import {
  Dropdown,
  Splitter
} from 'antd'

const e = window.translate
const { Panel } = Splitter

export default class FileListTableHeader extends Component {
  renderHeaderItem = (item) => {
    const {
      id,
      size,
      max,
      min
    } = item
    const isHandle = !id
    const { sortDirection, sortProp } = this.props
    const isSorting = !isHandle && sortProp === id
    const cls = classnames(
      'sftp-header-item',
      isHandle ? `shi-${id}` : `sftp-header-box shi-${id}`,
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

    const panelProps = {
      min: min + '%',
      max: max + '%',
      size: size + '%'
    }
    const text = e(id || '')
    const directionIcon = isSorting
      ? (sortDirection === 'asc' ? <DownOutlined /> : <UpOutlined />)
      : null
    const itemProps = {
      onClick: this.props.onClickName,
      className: cls,
      'data-id': id,
      title: text
    }
    return (
      <Panel {...panelProps} key={id}>
        <div
          {...itemProps}
        >
          {directionIcon} {text}
        </div>
      </Panel>
    )
  }

  render () {
    const { properties } = this.props
    const dropdownProps = {
      menu: {
        items: this.props.renderContextMenu(),
        onClick: this.props.onContextMenu
      },
      trigger: ['contextMenu']
    }
    const spliterProps = {
      onResizeEnd: this.props.onResize,
      onResize: this.props.onResize
    }
    return (
      <Dropdown {...dropdownProps}>
        <div
          className='sftp-file-table-header relative'
        >
          <Splitter {...spliterProps}>
            {
              properties.map(this.renderHeaderItem)
            }
          </Splitter>
        </div>
      </Dropdown>
    )
  }
}
