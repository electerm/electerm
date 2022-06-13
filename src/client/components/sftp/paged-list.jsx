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
    const {
      page, pageSize
    } = this.state
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
      showSizeChanger: false,
      size: 'small',
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
    const arr = this.renderList()
    if (this.props.hasPager) {
      arr.push(this.renderPager())
    }
    return arr
  }
}
