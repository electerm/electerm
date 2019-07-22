/**
 * history list
 */
import React from 'react'
import { Tooltip, Icon, Popconfirm } from 'antd'
import Search from '../common/search'
import createName from '../../common/create-title'
import classnames from 'classnames'
import _ from 'lodash'
import highlight from '../common/highlight'
import './list.styl'

const { prefix } = window
const e = prefix('menu')
const c = prefix('common')
const s = prefix('setting')

export default class ItemList extends React.PureComponent {
  state = {
    keyword: ''
  }

  onChange = e => {
    this.setState({
      keyword: e.target.value
    })
  }

  del = (item, e) => {
    e.stopPropagation()
    this.props.store.delItem(item, this.props.type)
  }

  renderSearch = () => {
    return (
      <div className='pd1y pd2r'>
        <Search
          onChange={this.onChange}
          value={this.state.keyword}
        />
      </div>
    )
  }

  renderDelBtn = item => {
    if (!item.id) {
      return null
    }
    const { shouldComfirmDel } = this.props
    const icon = (
      <Icon
        type='close'
        title={e('del')}
        className='pointer list-item-remove'
        onClick={
          shouldComfirmDel
            ? _.noop
            : e => this.del(item, e)
        }
      />
    )
    if (shouldComfirmDel) {
      return (
        <Popconfirm
          title={e('del') + '?'}
          onConfirm={e => this.del(item, e)}
          okText={e('del')}
          cancelText={c('cancel')}
          placement='top'
        >
          {icon}
        </Popconfirm>
      )
    }
    return icon
  }

  renderItem = (item, i) => {
    const { onClickItem, type, activeItemId } = this.props
    const { id } = item
    let title = createName(item)
    const cls = classnames(
      'item-list-unit',
      {
        active: activeItemId === id
      }
    )
    title = highlight(
      title,
      this.state.keyword
    )
    return (
      <div
        key={i + '__' + id}
        className={cls}
        onClick={() => onClickItem(item, type)}
      >
        <Tooltip
          title={title}
          placement='right'
        >
          <div className='elli pd1y pd2x'>{title || s('new')}</div>
        </Tooltip>
        {this.renderDelBtn(item)}
      </div>
    )
  }

  filter = list => {
    const { keyword } = this.state
    return keyword
      ? list.filter(item => {
        return createName(item).toLowerCase().includes(keyword.toLowerCase())
      })
      : list
  }

  render () {
    let {
      list = [],
      type,
      listStyle = {}
    } = this.props
    list = this.filter(list)
    return (
      <div className={`item-list item-type-${type}`}>
        {this.renderSearch()}
        <div className='item-list-wrap' style={listStyle}>
          {
            list.map(this.renderItem)
          }
        </div>
      </div>
    )
  }
}
