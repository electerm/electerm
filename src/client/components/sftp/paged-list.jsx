/**
 * file list module to limit files rendered to increase performance
 */

import { Component } from 'react'
import { Pagination } from 'antd'

export default class ScrollFiles extends Component {
  state = {
    page: 1,
    pageSize: 100
  }

  onChange = page => {
    this.setState({
      page
    })
  }

  renderList () {
    const page = this.props.page ?? this.state.page
    const pageSize = this.props.pageSize ?? this.state.pageSize
    const start = (page - 1) * pageSize
    const end = start + pageSize
    const {
      list, hasPager
    } = this.props
    const arr = hasPager
      ? list.slice(start, end)
      : list
    return arr.map(this.props.renderItem)
  }

  renderPager () {
    const props = {
      current: this.state.page,
      pageSize: this.state.pageSize,
      total: this.props.list.length,
      showLessItems: true,
      showSizeChanger: false,
      simple: false,
      onChange: this.onChange
    }
    return (
      <div className='pd1b pager-wrap'>
        <Pagination
          {...props}
        />
      </div>
    )
  }

  render () {
    return this.renderList()
  }
}
