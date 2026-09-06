/**
 * Trigger list for the settings panel (left col), follows quick commands list.
 */
import List from '../setting-panel/list'
import { PlusOutlined, CopyOutlined } from '@ant-design/icons'
import classnames from 'classnames'
import highlight from '../common/highlight'
import deepCopy from 'json-deep-copy'
import uid from '../../common/uid'
import TriggerTransport from './trigger-transport.jsx'

const e = window.translate

export default class TriggerSettingList extends List {
  del = (item, e) => {
    e.stopPropagation()
    this.props.store.delTrigger(item)
  }

  onClickItem = (item) => {
    this.props.onClickItem(item)
  }

  duplicateItem = (e, item) => {
    e.stopPropagation()
    const copy = deepCopy(item)
    copy.id = uid()
    copy.name = (item.name || e('unnamed')) + ' (copy)'
    window.store.addTrigger(copy)
  }

  renderDuplicateBtn = (item) => {
    if (!item.id) {
      return null
    }
    return (
      <CopyOutlined
        title={e('duplicate')}
        className='pointer list-item-duplicate'
        onClick={(e) => this.duplicateItem(e, item)}
      />
    )
  }

  renderItem = (item) => {
    if (!item) {
      return null
    }
    const { activeItemId } = this.props
    const { name, id } = item
    const cls = classnames(
      'item-list-unit',
      {
        active: activeItemId === id
      }
    )
    let title = name || e('unnamed')
    title = highlight(
      title,
      this.state.keyword
    )
    return (
      <div
        key={id}
        className={cls}
        onClick={() => this.onClickItem(item)}
      >
        <div className='elli pd1y pd2x' title={name}>
          {
            !id
              ? <PlusOutlined className='mg1r' />
              : null
          }
          {title}
        </div>
        {this.renderDuplicateBtn(item)}
        {this.renderDelBtn(item)}
      </div>
    )
  }

  renderTransport = () => {
    return (
      <TriggerTransport
        store={this.props.store}
      />
    )
  }
}
