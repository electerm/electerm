/**
 * theme list render
 */

import List from '../control/list'
import {Tooltip, Icon} from 'antd'
import classnames from 'classnames'
import {defaultTheme} from '../../common/terminal-theme'
import './terminal-theme-list.styl'

export default class ThemeList extends List {

  del = (item, e) => {
    e.stopPropagation()
    this.props.delTheme(item)
  }

  renderApplyBtn = item => {
    if (!item.id) {
      return null
    }
    return (
      <Tooltip
        title="apply"
        placement="top"
      >
        <Icon
          type="check-circle-o"
          title="apply"
          className="pointer list-item-apply"
          onClick={() => this.props.setTheme(item.id)}
        />
      </Tooltip>
    )
  }

  onClickTheme = item => {
    this.props.onClickItem(item)
  }

  renderItem = (item, i) => {
    let {activeItemId, theme} = this.props
    let {name, id} = item
    let cls = classnames(
      'item-list-unit',
      {
        current: theme === id
      },
      {
        active: activeItemId === id
      }
    )
    return (
      <div
        key={i + name}
        className={cls}
        onClick={() => this.onClickTheme(item)}
      >
        <Tooltip
          title={name}
          placement="right"
        >
          <div className="elli pd1y pd2x">{name}</div>
        </Tooltip>
        {
          id === defaultTheme.id
            ? null
            : this.renderDelBtn(item)
        }
        {this.renderApplyBtn(item)}
      </div>
    )
  }

}

