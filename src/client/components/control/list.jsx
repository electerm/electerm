/**
 * hisotry/bookmark list
 */
import React from 'react'
import {Tooltip, Icon} from 'antd'
import Search from '../common/search'
import createName from '../../common/create-title'
import classnames from 'classnames'
import './list.styl'

const {prefix} = window
const e = prefix('menu')

export default class ItemList extends React.Component {

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
    this.props.delItem(item, this.props.type)
  }

  renderSearch = () => {
    return (
      <div className="pd1y pd2r">
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
    return (
      <Tooltip
        title={e('del')}
        placement="top"
      >
        <Icon
          type="close"
          className="pointer list-item-remove"
          onClick={e => this.del(item, e)}
        />
      </Tooltip>
    )
  }

  renderItem = (item, i) => {
    let {onClickItem, type, activeItemId} = this.props
    let {id} = item
    let title = createName(item)
    let cls = classnames(
      'item-list-unit',
      {
        active: activeItemId === id
      }
    )
    return (
      <div
        key={i + type + id}
        className={cls}
        onClick={() => onClickItem(item, type)}
      >
        <Tooltip
          title={title}
          placement="right"
        >
          <div className="elli pd1y pd2x">{title}</div>
        </Tooltip>
        {this.renderDelBtn(item)}
      </div>
    )
  }

  filter = list => {
    let {keyword} = this.state
    return keyword
      ? list.filter(item => {
        return createName(item).toLowerCase().includes(keyword.toLowerCase())
      })
      : list
  }

  render() {
    let {
      list,
      type
    } = this.props
    list = this.filter(list)
    return (
      <div className={`item-list item-type-${type}`}>
        {this.renderSearch()}
        <div className="item-list-wrap">
          {
            list.map(this.renderItem)
          }
        </div>
      </div>
    )
  }

}

