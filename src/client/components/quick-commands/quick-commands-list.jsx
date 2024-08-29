/**
 * quick command list render
 */

import List from '../setting-panel/list'
import { PlusOutlined } from '@ant-design/icons'
import { Select } from 'antd'
import classnames from 'classnames'
import highlight from '../common/highlight'
import QmTransport from './quick-command-transport'
import onDrop from './on-drop'

const { Option } = Select
const e = window.translate

export default class QuickCommandsList extends List {
  del = (item, e) => {
    e.stopPropagation()
    this.props.store.delQuickCommand(item)
  }

  onClickItem = (item) => {
    this.props.onClickItem(item)
  }

  handleChangeLabel = v => {
    this.setState({
      labels: v
    })
  }

  getLabels = () => {
    return this.props.store.quickCommandTags
  }

  handleDragOver = e => {
    e.preventDefault()
  }

  handleDragStart = e => {
    e.dataTransfer.setData('idDragged', e.target.getAttribute('data-id'))
  }

  // adjust window.store.quickCommands array order when drop, so that the dragged item will be placed at the right position, e.target.getAttribute('data-id') would target item id, e.dataTransfer.getData('idDragged') would target dragged item id
  handleDrop = e => {
    onDrop(e)
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
        draggable
        onDragOver={this.handleDragOver}
        onDragStart={this.handleDragStart}
        onDrop={this.handleDrop}
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
      <QmTransport
        store={this.props.store}
      />
    )
  }

  renderLabels = () => {
    const arr = this.getLabels()
    const props = {
      placeholder: e('labels'),
      mode: 'multiple',
      value: this.state.labels,
      onChange: this.handleChangeLabel,
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
