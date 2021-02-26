/**
 * theme list render
 */

import List from '../setting-panel/list'
import { CheckCircleOutlined, PlusOutlined } from '@ant-design/icons'
import { Tooltip } from 'antd'
import classnames from 'classnames'
import { defaultTheme } from '../../common/constants'
import highlight from '../common/highlight'
import './terminal-theme-list.styl'

const { prefix } = window
const e = prefix('terminalThemes')

export default class ThemeList extends List {
  del = (item, e) => {
    e.stopPropagation()
    this.props.store.delTheme(item)
  }

  renderApplyBtn = item => {
    if (!item.id) {
      return null
    }
    return (
      <Tooltip
        title={e('apply')}
        placement='topLeft'
      >
        <CheckCircleOutlined
          className='pointer list-item-apply'
          onClick={() => this.props.store.setTheme(item.id)} />
      </Tooltip>
    )
  }

  onClickTheme = item => {
    this.props.onClickItem(item)
  }

  renderItem = (item, i) => {
    const { activeItemId } = this.props
    const { theme } = this.props
    const { name, id } = item
    const cls = classnames(
      'item-list-unit theme-item',
      {
        current: theme === id
      },
      {
        active: activeItemId === id
      }
    )
    let title = id === defaultTheme.id
      ? e(id)
      : name
    title = highlight(
      title,
      this.state.keyword
    )
    return (
      <div
        key={i + id}
        className={cls}
        onClick={() => this.onClickTheme(item)}
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
        {
          id === defaultTheme.id
            ? null
            : this.renderDelBtn(item)
        }
        {this.renderApplyBtn(item)}
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
