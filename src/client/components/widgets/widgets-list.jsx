/**
 * widgets list
 */
import React from 'react'
import WidgetInstances from './widget-instances'
import WidgetControl from './widget-control'
import classnames from 'classnames'
import highlight from '../common/highlight'

const e = window.translate

export default class WidgetsList extends React.PureComponent {
  state = {
    tab: 'widgets', // or instances
    selectedWidget: null,
    widgets: [],
    keyword: '',
    ready: false
  }

  componentDidMount () {
    this.timer = setTimeout(() => {
      this.setState({
        ready: true
      })
    }, 200)
    this.loadWidgets()
  }

  componentWillUnmount () {
    clearTimeout(this.timer)
  }

  async loadWidgets () {
    try {
      const widgets = await window.store.listWidgets()
      this.setState({ widgets })
    } catch (error) {
      console.error('Failed to load widgets:', error)
    }
  }

  handleSearch = (e) => {
    this.setState({
      keyword: e.target.value
    })
  }

  onClickWidget = (widget) => {
    this.setState({
      selectedWidget: widget
    })
  }

  renderWidgetItem = (widget, i) => {
    const { keyword } = this.state
    const title = widget.info.name
    const tag = ''
    const cls = classnames(
      'item-list-unit',
      {
        active: false
      }
    )
    const titleHighlight = highlight(
      title,
      keyword
    )
    return (
      <div
        key={widget.id}
        className={cls}
        onClick={() => this.onClickWidget(widget)}
      >
        <div
          title={title}
          className='elli pd1y pd2x list-item-title'
        >
          {tag}{titleHighlight || e('new')}
        </div>
      </div>
    )
  }

  renderWidgetControl = () => {
    const { selectedWidget } = this.state
    return (
      <div className='widget-control-container'>
        <div className='widget-control-header'>
          <button
            className='btn btn-default'
            onClick={() => this.setState({ selectedWidget: null })}
          >
            ← Back to Widgets
          </button>
        </div>
        <WidgetControl
          widget={selectedWidget}
          onInstanceCreated={() => {
            // Could switch to instances tab or refresh
          }}
        />
      </div>
    )
  }

  renderWidgetsList = () => {
    const { widgets, keyword } = this.state
    const filteredWidgets = keyword
      ? widgets.filter(widget => widget.info.name.toLowerCase().includes(keyword.toLowerCase()))
      : widgets

    return (
      <div className='item-list item-type-widgets'>
        <div className='pd1y'>
          <input
            type='text'
            placeholder='Search widgets...'
            value={keyword}
            onChange={this.handleSearch}
            className='form-control'
          />
        </div>
        <div className='item-list-wrap'>
          {filteredWidgets.map(this.renderWidgetItem)}
        </div>
      </div>
    )
  }

  render () {
    if (!this.state.ready) {
      return null
    }

    const { selectedWidget, tab } = this.state

    if (selectedWidget) {
      return this.renderWidgetControl()
    }

    if (tab === 'widgets') {
      return (
        <div>
          {this.renderWidgetsList()}
          <div className='widget-instances-section'>
            <h3>Running Instances</h3>
            <WidgetInstances
              widgetInstances={this.props.widgetInstances || []}
            />
          </div>
        </div>
      )
    }

    return (
      <WidgetInstances
        widgetInstances={this.props.widgetInstances || []}
      />
    )
  }
}
