/**
 * quick command list render
 */

import List from '../setting-panel/list'
import { PlusOutlined } from '@ant-design/icons'
import classnames from 'classnames'
import highlight from '../common/highlight'
import ProfileTransport from './profile-transport'
import {
  settingMap
} from '../../common/constants'

export default class ProfileList extends List {
  del = (item, e) => {
    e.stopPropagation()
    this.props.store.delItem(item, settingMap.profiles)
  }

  onClickItem = (item) => {
    this.props.onClickItem(item)
  }

  renderItem = (item, i) => {
    if (!item) {
      return null
    }
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
        data-id={id}
      >
        <div className='elli pd1y pd2x' title={name}>
          {
            !id
              ? <PlusOutlined className='mg1r' />
              : null
          }
          {title}
        </div>
        {this.renderDelBtn(item)}
      </div>
    )
  }

  renderTransport = () => {
    return (
      <ProfileTransport />
    )
  }

  filter = list => {
    const { keyword } = this.state
    return keyword
      ? list.filter((item) => {
        const n = (item.name || '').toLowerCase()
        const k = keyword.toLowerCase()
        return n.includes(k)
      })
      : list
  }
}
