/**
 * quick command list render
 */

import List from '../setting-panel/list'
import { PlusOutlined } from '@ant-design/icons'
import { Tooltip } from 'antd'
import classnames from 'classnames'
import highlight from '../common/highlight'
import { settingMap } from '../../common/constants'

export default class QuickCommandsList extends List {
  del = (item, e) => {
    e.stopPropagation()
    this.props.store.delItem(item, settingMap.quickCommands)
  }

  onClickItem = (item) => {
    this.props.onClickItem(item)
  }

  renderItem = (item, i) => {
    const { activeItemId } = this.props
    const { name, id } = item
    const cls = classnames(
      'item-list-unit theme-item',
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
          placement='topLeft'
        >
          <div className='elli pd1y pd2x'>
            {
              !id
                ? <PlusOutlined className='mg1r' />
                : null
            }
            {title}
          </div>
        </Tooltip>
        {this.renderDelBtn(item)}
      </div>
    )
  }

  filter = list => {
    const { keyword } = this.state
    return keyword
      ? list.filter((item) => {
        const n = (item.name || '').toLowerCase()
        const c = (item.command || '').toLowerCase()
        const k = keyword.toLowerCase()
        return n.includes(k) || c.includes(k)
      })
      : list
  }
}
