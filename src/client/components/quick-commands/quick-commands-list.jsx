/**
 * quick command list render
 */

import List from '../setting-panel/list'
import { PlusOutlined, CopyOutlined, TagsOutlined } from '@ant-design/icons'
import { Select, Button } from 'antd'
import classnames from 'classnames'
import highlight from '../common/highlight'
import QmTransport from './quick-command-transport'
import onDrop from './on-drop'
import { isDropAfterHalf, setDropIndicator, clearDropIndicator } from '../../common/drop-position'
import copy from 'json-deep-copy'
import uid from '../../common/uid'
import QmLabelGroup from './qm-label-group'
import { groupByLabel, hasLabels } from '../../common/quick-command-groups'

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
    const el = e.target.closest('.item-list-unit')
    if (el) {
      setDropIndicator(el, isDropAfterHalf(e, el))
    }
  }

  handleDragStart = e => {
    const dragElement = e.target.closest('.item-list-unit')
    if (dragElement) {
      e.dataTransfer.setData('idDragged', dragElement.getAttribute('data-id'))
    }
  }

  handleDragEnter = e => {
    e.preventDefault()
    const el = e.target.closest('.item-list-unit')
    if (el) {
      setDropIndicator(el, isDropAfterHalf(e, el))
    }
  }

  handleDragLeave = e => {
    const el = e.target.closest('.item-list-unit')
    if (el) {
      clearDropIndicator(el)
    }
  }

  handleDrop = e => {
    const el = e.target.closest('.item-list-unit')
    if (el) {
      clearDropIndicator(el)
    }
    onDrop(e, '.item-list-unit')
  }

  duplicateItem = (e, item) => {
    e.stopPropagation()
    const { store } = window
    const newCommand = copy(item)
    newCommand.id = uid()
    const baseName = item.name.replace(/\(\d+\)$/, '')
    const sameNameCount = store.currentQuickCommands.filter(
      cmd => cmd.name && cmd.name.replace(/\(\d+\)$/, '').includes(baseName)
    ).length
    const duplicateIndex = sameNameCount > 0 ? sameNameCount : 1
    newCommand.name = baseName + '(' + duplicateIndex + ')'
    store.addQuickCommand(newCommand)
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

  renderItem = (item, i) => {
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
        // grouped, a drop only reorders the flat list, which does not show
        draggable={!this.props.groupByLabel}
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
        {this.renderDuplicateBtn(item)}
        {this.renderDelBtn(item)}
      </div>
    )
  }

  // under label headings, unless turned off or nothing has a label. A
  // search opens every heading so no match is hidden.
  renderList = list => {
    const { groupByLabel: grouped, collapsedLabels = [] } = this.props
    if (!grouped || !hasLabels(list)) {
      return list.map(this.renderItem)
    }
    const { keyword, labels } = this.state
    return groupByLabel(list, labels).map(g => (
      <QmLabelGroup
        key={'qmg-' + g.label}
        label={g.label}
        count={g.items.length}
        collapsed={!keyword && collapsedLabels.includes(g.label)}
        className='qm-label-group-list'
      >
        {g.items.map(this.renderItem)}
      </QmLabelGroup>
    ))
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
      className: 'qm-list-label-select'
    }
    const { groupByLabel: grouped } = this.props
    return (
      <div className='pd1b qm-list-labels'>
        <Button
          type={grouped ? 'primary' : 'default'}
          icon={<TagsOutlined />}
          title={e('group')}
          onClick={() => window.store.setQmGroupByLabel(!grouped)}
          className='qm-group-btn'
        />
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
            (cmd.command || cmd.key || cmd.text || '').toLowerCase().includes(k) ||
            (cmd.name || '').toLowerCase().includes(k)
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
