/**
 * quick command list render
 */

import List from '../setting-panel/list'
import { PlusOutlined } from '@ant-design/icons'
import { Select, Tooltip } from 'antd'
import classnames from 'classnames'
import highlight from '../common/highlight'
import { settingMap } from '../../common/constants'
import QmTransport from './quick-command-transport'

const { Option } = Select
const { prefix } = window
const q = prefix('quickCommands')

export default class QuickCommandsList extends List {
  del = (item, e) => {
    e.stopPropagation()
    this.props.store.delItem(item, settingMap.quickCommands)
  }

  onClickItem = (item) => {
    this.props.onClickItem(item)
  }

  handleChange = v => {
    this.setState({
      labels: v
    })
  }

  getLabels = () => {
    return this.props.store.quickCommandTags
  }

  renderItem = (item, i) => {
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
      >
        <Tooltip
          title={name}
          placement='topLeft'
        >
          <div className='elli pd1y pd2x'>
            {
              !id
                ? <PlusOutlined className='mg1r' />
                : null
            }
            {title}
          </div>
        </Tooltip>
        {this.renderDelBtn(item)}
      </div>
    )
  }

  renderTransport = () => {
    return (
      <QmTransport
        store={this.props.store}
      />
    )
  }

  renderLabels = () => {
    const arr = this.getLabels()
    const props = {
      placeholder: q('labels'),
      mode: 'multiple',
      value: this.state.labels,
      onChange: this.handleChange,
      style: {
        width: '100%'
      }
    }
    return (
      <div className='pd1b'>
        <Select
          {...props}
        >
          {
            arr.map(b => {
              return (
                <Option
                  key={'qml-' + b}
                  value={b}
                >
                  {b}
                </Option>
              )
            })
          }
        </Select>
      </div>
    )
  }

  filter = list => {
    const { keyword, labels } = this.state
    const f = keyword
      ? list.filter((item) => {
        const n = (item.name || '').toLowerCase()
        const c = (item.command || '').toLowerCase()
        const k = keyword.toLowerCase()
        return n.includes(k) || c.includes(k)
      })
      : list
    return labels.length
      ? f.filter(d => {
        return labels.some(label => {
          return (d.labels || []).includes(label)
        })
      })
      : f
  }
}
