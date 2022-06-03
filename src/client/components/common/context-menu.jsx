/**
 * context menu
 */
import React from 'react'
import './context-menu.styl'
import classnames from 'classnames'
import {
  contextMenuHeight,
  contextMenuPaddingTop,
  contextMenuWidth,
  topMenuHeight,
  commonActions
} from '../../common/constants'
import {
  Popconfirm
} from 'antd'
import postMessage from '../../common/post-msg'
import _ from 'lodash'
import IconHolder from './icon-holder'
import {
  CheckOutlined,
  CloudDownloadOutlined,
  CloudUploadOutlined,
  ArrowRightOutlined,
  CheckSquareOutlined,
  CloseCircleOutlined,
  ContainerOutlined,
  CopyOutlined,
  EditOutlined,
  EnterOutlined,
  FileAddOutlined,
  FileExcelOutlined,
  FolderAddOutlined,
  InfoCircleOutlined,
  LockOutlined,
  ReloadOutlined
} from '@ant-design/icons'

const { prefix } = window
const c = prefix('common')

export default class ContextMenu extends React.PureComponent {
  state = {
    items: [],
    id: '',
    pos: {
      left: 0,
      top: 0
    },
    className: 'context-menu'
  }

  componentDidMount () {
    window.addEventListener('message', e => {
      const {
        type,
        data
      } = e.data || {}
      if (
        type === commonActions.closeContextMenu
      ) {
        this.closeContextMenu()
      } else if (type === commonActions.openContextMenu) {
        this.setOnCloseEvent()
        this.setState(data)
      }
    })
  }

  setOnCloseEvent = () => {
    document
      .getElementById('outside-context')
      .addEventListener('click', this.onTriggerClose)
  }

  onTriggerClose = () => {
    this.closeContextMenu()
    document
      .getElementById('outside-context')
      .removeEventListener('click', this.onTriggerClose)
  }

  icons = {
    IconHolder,
    CheckOutlined,
    CloudDownloadOutlined,
    CloudUploadOutlined,
    ArrowRightOutlined,
    CheckSquareOutlined,
    CloseCircleOutlined,
    ContainerOutlined,
    CopyOutlined,
    EditOutlined,
    EnterOutlined,
    FileAddOutlined,
    FileExcelOutlined,
    FolderAddOutlined,
    InfoCircleOutlined,
    LockOutlined,
    ReloadOutlined
  }

  closeContextMenu = () => {
    this.setState({
      id: '',
      items: []
    })
  }

  computePos = () => {
    const {
      pos,
      items
    } = this.state
    const { length } = items
    const count = length
      ? items.filter(c => c.type !== 'hr').length
      : 3
    const countHr = length
      ? items.filter(c => c.type === 'hr').length
      : 3
    let {
      left,
      top
    } = pos
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

  onClick = (e, item) => {
    const {
      disabled,
      func,
      args,
      noCloseMenu
    } = item
    if (disabled) {
      return
    }
    postMessage({
      action: commonActions.clickContextMenu,
      id: this.state.id,
      args,
      func
    })
    if (!noCloseMenu) {
      this.closeContextMenu()
    }
  }

  renderItem = (item, i) => {
    const {
      disabled,
      icon,
      text,
      noAutoClose,
      requireConfirm,
      confirmTitle,
      subText,
      className
    } = item
    let iconElem = null
    if (icon && this.icons[icon]) {
      const Icon = this.icons[icon]
      iconElem = <Icon />
    }
    const cls = classnames(
      'pd2x pd1y context-item pointer',
      {
        disabled
      },
      {
        'no-auto-close-context': noAutoClose
      },
      className
    )
    const act = requireConfirm
      ? _.noop
      : (e) => this.onClick(e, item)
    const unit = (
      <div
        key={`context-item-${i}-${text}`}
        className={cls}
        onClick={act}
      >
        {iconElem}{iconElem ? ' ' : ''}{text}
        {
          subText
            ? (<span className='context-sub-text'>{subText}</span>)
            : null
        }
      </div>
    )
    if (!requireConfirm) {
      return unit
    }
    const title = (
      <div className='wordbreak'>{confirmTitle}</div>
    )
    return (
      <Popconfirm
        cancelText={c('cancel')}
        key={`context-item-${i}-${text}`}
        okText={c('ok')}
        title={title}
        onConfirm={(e) => this.onClick(e, item)}
      >
        {unit}
      </Popconfirm>
    )
  }

  renderItems = () => {
    return this.state.items.map(this.renderItem)
  }

  render () {
    const { id, className } = this.state
    if (!id) {
      return null
    }
    const {
      pos,
      shouldScroll,
      realHeight
    } = this.computePos()
    const cls = classnames(
      className,
      id ? 'show' : 'hide',
      shouldScroll ? 'scroll' : ''
    )
    const innerProps = {
      className: 'context-menu-inner',
      style: {
        height: (realHeight - contextMenuPaddingTop * 2) + 'px'
      }
    }
    return (
      <div
        className={cls}
        style={pos}
      >
        <div
          {...innerProps}
        >
          {this.renderItems()}
        </div>
      </div>
    )
  }
}
