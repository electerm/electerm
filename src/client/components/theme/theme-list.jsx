/**
 * theme list render
 */

import List from '../setting-panel/list'
import { LoadingOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { pick } from 'lodash-es'
import { Pagination } from 'antd'
import ThemeListItem from './theme-list-item'
import { defaultTheme } from '../../common/constants'
import './terminal-theme-list.styl'

const e = window.translate

export default class ThemeList extends List {
  handlePager = page => {
    this.setState({ page })
  }

  handlePageSizeChange = (page, pageSize) => {
    this.setState({ pageSize, page })
  }

  renderItem = (item, i) => {
    const itemProps = {
      item,
      renderDelBtn: this.renderDelBtn,
      activeItemId: this.props.activeItemId,
      ...pick(
        this.props,
        [
          'onClickItem',
          'theme',
          'keyword'
        ]
      )
    }
    return (
      <ThemeListItem key={item.id} {...itemProps} />
    )
  }

  renderCurrentTheme () {
    const { theme, list } = this.props
    const item = list.find(d => d.id === theme)
    if (!item) {
      return null
    }
    const { name, id } = item
    const title = id === defaultTheme.id
      ? e(id)
      : name
    return (
      <div className='pd2'>
        <CheckCircleOutlined className='mg1r' />
        {title}
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
    if (!ready) {
      return (
        <div className='pd3 aligncenter'>
          <LoadingOutlined />
        </div>
      )
    }
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
        {this.renderCurrentTheme()}
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
          showLessItems
          simple
          onShowSizeChange={this.handlePageSizeChange}
        />
      </div>
    )
  }
}
