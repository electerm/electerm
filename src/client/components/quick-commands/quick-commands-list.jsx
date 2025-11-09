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
    const dragElement = e.target.closest('.item-list-unit')
    if (dragElement) {
      e.dataTransfer.setData('idDragged', dragElement.getAttribute('data-id'))
    }
  }

  handleDragEnter = e => {
    e.target.closest('.item-list-unit').classList.add('dragover')
  }

  handleDragLeave = e => {
    e.target.closest('.item-list-unit').classList.remove('dragover')
  }

  handleDrop = e => {
    onDrop(e, '.item-list-unit')
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
        key={id}
        className={cls}
        onClick={() => this.onClickItem(item)}
        data-id={id}
        draggable
        onDragOver={this.handleDragOver}
        onDragStart={this.handleDragStart}
        onDrop={this.handleDrop}
        onDragEnter={this.handleDragEnter}
        onDragLeave={this.handleDragLeave}
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
        const k = keyword.toLowerCase()

        // Check if item has commands array
        if (item.commands && Array.isArray(item.commands)) {
          // Search in each command in the commands array
          return n.includes(k) || item.commands.some(cmd =>
            (cmd.command || '').toLowerCase().includes(k)
          )
        } else {
          // Fallback to the old behavior for backward compatibility
          const c = (item.command || '').toLowerCase()
          return n.includes(k) || c.includes(k)
        }
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
