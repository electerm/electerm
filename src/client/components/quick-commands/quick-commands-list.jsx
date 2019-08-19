/**
 * quick command list render
 */

import List from '../setting-panel/list'
import { Tooltip } from 'antd'
import classnames from 'classnames'
import highlight from '../common/highlight'
import { settingMap } from '../../common/constants'

export default class QuickCommandsList extends List {
  del = (item, e) => {
    e.stopPropagation()
    this.props.store.delItem(item, settingMap.quickCommands)
  }

  onClickItem = item => {
    this.props.onClickItem(item)
  }

  renderItem = (item, i) => {
    const { activeItemId } = this.props
    const { quickCommandId } = this.props
    const { name, id } = item
    const cls = classnames(
      'item-list-unit theme-item',
      {
        current: quickCommandId === id
      },
      {
        active: activeItemId === id
      }
    )
    let title = name
    title = highlight(
      title,
      this.state.keyword
    )
    return (
      <div
        key={i + id}
        className={cls}
        onClick={() => this.onClickItem(item)}
      >
        <Tooltip
          title={name}
          placement='right'
        >
          <div className='elli pd1y pd2x'>{title}</div>
        </Tooltip>
        {this.renderDelBtn(item)}
      </div>
    )
  }

  filter = list => {
    const { keyword } = this.state
    return keyword
      ? list.filter(item => {
        return item.name.toLowerCase().includes(keyword.toLowerCase())
      })
      : list
  }
}
