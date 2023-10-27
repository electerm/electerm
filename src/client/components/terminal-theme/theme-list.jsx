/**
 * theme list render
 */

import List from '../setting-panel/list'
import { CheckCircleOutlined, PlusOutlined, LoadingOutlined } from '@ant-design/icons'
import { Tooltip, Pagination } from 'antd'
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

  handlePager = page => {
    this.setState({ page })
  }

  handlePageSizeChange = (page, pageSize) => {
    this.setState({ pageSize, page })
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
          onClick={() => this.props.store.setTheme(item.id)}
        />
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
        <div className='elli pd1y pd2x' title={name}>
          {
            !id
              ? <PlusOutlined className='mg1r' />
              : null
          }
          {title}
        </div>
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
    const { keyword, ready } = this.state
    return keyword
      ? list.slice(0, ready ? list.length : 2).filter(item => {
        return item.name.toLowerCase().includes(keyword.toLowerCase())
      })
      : list.slice(0, ready ? list.length : 2)
  }

  paged = list => {
    const { pageSize, ready, page } = this.state
    if (!ready) {
      return list
    }
    return list.slice((page - 1) * pageSize, pageSize * page)
  }

  render () {
    const { ready, page, pageSize } = this.state
    let {
      list = [],
      type,
      listStyle = {}
    } = this.props
    list = this.filter(list)
    const all = list.length
    list = this.paged(this.filter(list))
    return (
      <div className={`item-list item-type-${type}`}>
        {this.renderTransport ? this.renderTransport() : null}
        {this.renderLabels ? this.renderLabels() : null}
        {this.renderSearch()}
        <div className='item-list-wrap' style={listStyle}>
          {
            list.map(this.renderItem)
          }
        </div>
        <Pagination
          onChange={this.handlePager}
          total={all}
          current={page}
          pageSize={pageSize}
          onShowSizeChange={this.handlePageSizeChange}
        />
        {
          ready
            ? null
            : (
              <div className='pd3 aligncenter'>
                <LoadingOutlined />
              </div>
              )
        }
      </div>
    )
  }
}
