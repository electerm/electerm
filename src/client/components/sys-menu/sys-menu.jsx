/**
 * context menu
 */
import { PureComponent } from 'react'
import './sys-menu.styl'
import classnames from 'classnames'
import {
  Popconfirm
} from 'antd'
import { noop } from 'lodash-es'
import History from './history'
import Bookmark from './boomarks'
import Tabs from './tabs'
import Zoom from './zoom'
import icons from './icons-map'
import { refsStatic } from '../common/ref'

const e = window.translate

export default class ContextMenu extends PureComponent {
  modules = {
    History,
    Bookmark,
    Tabs,
    Zoom
  }

  onClick = (e, item) => {
    const {
      disabled,
      func
    } = item
    if (disabled) {
      return
    }
    const menu = refsStatic.get('menu-btn')
    if (!menu) {
      return
    }
    if (func) {
      menu[func]()
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
      <Mod {...this.props} />
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
    const baseCls = 'context-item'
    if (module && this.modules[module]) {
      const Mod = this.modules[module]
      return (
        <div className={baseCls}>
          <Mod {...this.props} />
        </div>
      )
    }
    let iconElem = null
    if (icon && icons[icon]) {
      const Icon = icons[icon]
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
      ? noop
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
        cancelText={e('cancel')}
        key={`context-item-${i}-${text}`}
        okText={e('ok')}
        title={title}
        onConfirm={(e) => this.onClick(e, item)}
      >
        {unit}
      </Popconfirm>
    )
  }

  renderItems = () => {
    return this.props.items.map(this.renderItem)
  }

  render () {
    const cls = 'context-menu'
    const innerProps = {
      className: 'context-menu-inner'
    }
    return (
      <div
        className={cls}
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
