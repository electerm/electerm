/**
 * history list
 */
import React from 'react'
import { CloseOutlined, EditOutlined } from '@ant-design/icons'
import { Popconfirm } from 'antd'
import Search from '../common/search'
import createName from '../../common/create-title'
import classnames from 'classnames'
import _ from 'lodash'
import highlight from '../common/highlight'
import { settingSyncId, settingCommonId } from '../../common/constants'
import './list.styl'

const { prefix } = window
const e = prefix('menu')
const c = prefix('common')
const s = prefix('setting')

export default class ItemList extends React.PureComponent {
  state = {
    keyword: '',
    labels: []
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

  editItem = (e, item, isGroup) => {
    e.stopPropagation()
    this.props.store.openBookmarkEdit(item)
  }

  renderSearch = () => {
    return (
      <div className='pd1y'>
        <Search
          onChange={this.onChange}
          value={this.state.keyword}
        />
      </div>
    )
  }

  renderDelBtn = item => {
    if (!item.id || [settingSyncId, settingCommonId].includes(item.id) || item.id.startsWith('default')) {
      return null
    }
    const { shouldConfirmDel } = this.props
    const icon = (
      <CloseOutlined
        title={e('del')}
        className='pointer list-item-remove'
        onClick={
          shouldConfirmDel
            ? _.noop
            : e => this.del(item, e)
        } />
    )
    if (shouldConfirmDel) {
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
    const title = createName(item)
    const cls = classnames(
      'item-list-unit',
      {
        active: activeItemId === id
      }
    )
    const titleHighlight = highlight(
      title,
      this.state.keyword
    )
    const isGroup = false
    return (
      <div
        key={i + '__' + id}
        className={cls}
        onClick={() => onClickItem(item, type)}
      >
        <div
          title={title}
          className='elli pd1y pd2x list-item-title'
        >{titleHighlight || s('new')}</div>
        {this.renderDelBtn(item)}
        {this.renderEditBtn(item, isGroup)}
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

  renderEditBtn = (item, isGroup) => {
    if (
      (this.props.staticList && isGroup) ||
      (!this.props.staticList && !isGroup)
    ) {
      return null
    }
    return (
      <EditOutlined
        title={e('edit')}
        onClick={(e) => this.editItem(e, item, isGroup)}
        className='pointer list-item-edit' />
    )
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
        {this.renderTransport ? this.renderTransport() : null}
        {this.renderLabels ? this.renderLabels() : null}
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
