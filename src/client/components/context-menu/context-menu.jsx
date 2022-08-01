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
  commonActions
} from '../../common/constants'
import {
  Popconfirm
} from 'antd'
import postMessage from '../../common/post-msg'
import _ from 'lodash'
import History from './history'
import Bookmark from './boomarks'
import Tabs from './tabs'
import Zoom from './zoom'
import IconHolder from './icon-holder'
import {
  CodeOutlined,
  BorderHorizontalOutlined,
  SearchOutlined,
  SelectOutlined,
  SwitcherOutlined,
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
    CodeOutlined,
    BorderHorizontalOutlined,
    SearchOutlined,
    SelectOutlined,
    SwitcherOutlined,
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

  modules = {
    History,
    Bookmark,
    Tabs,
    Zoom
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
    const {
      topMenuHeight
    } = this.props.store
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

  renderSubText = (subText) => {
    return subText
      ? (<span className='context-sub-text'>{subText}</span>)
      : null
  }

  renderSubMenu = (submenu) => {
    if (!submenu) {
      return
    }
    const Mod = this.modules[submenu]
    return (
      <Mod store={this.props.store} />
    )
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
      className,
      type,
      module,
      submenu
    } = item
    if (type === 'hr') {
      return <hr />
    }
    const baseCls = 'pd2x pd1y context-item pointer'
    if (module && this.modules[module]) {
      const Mod = this.modules[module]
      return (
        <div className={baseCls}>
          <Mod store={this.props.store} />
        </div>
      )
    }
    let iconElem = null
    if (icon && this.icons[icon]) {
      const Icon = this.icons[icon]
      iconElem = <Icon />
    }
    const cls = classnames(
      baseCls,
      {
        disabled
      },
      {
        'no-auto-close-context': noAutoClose
      },
      className,
      {
        'with-sub-menu': submenu
      }
    )
    const act = requireConfirm || submenu
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
          this.renderSubText(subText)
        }
        {
          this.renderSubMenu(submenu)
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
