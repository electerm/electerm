/**
 * theme list render
 */

import React from 'react'
import {Tooltip, Icon} from 'antd'
import Search from '../common/search'
import createName from '../../common/create-title'
import classnames from 'classnames'

export default class ThemeList extends React.Component {

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
    this.props.delTheme(item)
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
        title="delete"
        placement="right"
      >
        <Icon
          type="close"
          title="delete"
          className="pointer list-item-remove"
          onClick={e => this.del(item, e)}
        />
      </Tooltip>
    )
  }

  renderItem = (item, i) => {
    let {onClickTheme, activeThemeName, currentThemeName} = this.props
    let {name} = item
    let cls = classnames(
      'item-list-unit',
      {
        current: currentThemeName === name
      },
      {
        active: activeThemeName === name
      }
    )
    return (
      <div
        key={i + name}
        className={cls}
        onClick={() => onClickTheme(item)}
      >
        <Tooltip
          title={name}
          placement="right"
        >
          <div className="elli pd1y pd2x">{name}</div>
        </Tooltip>
        {this.renderDelBtn(item)}
      </div>
    )
  }

  render() {
    let {
      list,
      type
    } = this.props
    let {keyword} = this.state
    list = keyword
      ? list.filter(item => {
        return item.name.toLowerCase().includes(keyword.toLowerCase())
      })
      : list
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

