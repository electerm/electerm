/**
 * file section
 */

import {Component} from '../common/react-subx'
import {Icon, Tooltip, message, Badge} from 'antd'
import classnames from 'classnames'
import copy from 'json-deep-copy'
import _ from 'lodash'
import Input from '../common/input-auto-focus'
import createName from '../../common/create-title'
import {addClass, removeClass} from '../../common/class'
import {generate} from 'shortid'
import newTerm from '../../common/new-terminal'

const {prefix} = window
const e = prefix('tabs')
const m = prefix('menu')
const onDragCls = 'ondrag-tab'
const onDragOverCls = 'dragover-tab'

export default class Tab extends Component {

  state = {
    isEditting: false,
    titleTemp: ''
  }

  componentDidMount() {
    this.dom = document.getElementById('id' + this.props.tab.id)
  }

  clearCls = () => {
    document.querySelectorAll('.' + onDragOverCls).forEach((d) => {
      removeClass(d, onDragOverCls)
    })
  }

  onDrag = () => {
    addClass(this.dom, onDragCls)
  }

  onDragEnter = () => {
    this.clearCls()
    addClass(this.dom, onDragOverCls)
  }

  onDragExit = () => {
    //debug('ondragexit')
    //let {target} = e
    //removeClass(target, 'sftp-dragover')
  }

  onDragLeave = e => {
    //debug('ondragleave')
    let {target} = e
    removeClass(target, onDragOverCls)
  }

  onDragOver = e => {
    //debug('ondragover')
    //debug(e.target)
    //removeClass(this.dom, 'sftp-dragover')
    e.preventDefault()
  }

  onDragStart = e => {
    //debug('ondragstart')
    //debug(e.target)
    e.dataTransfer.setData('fromFile', JSON.stringify(this.props.tab))
    //e.effectAllowed = 'copyMove'
  }

  onDrop = e => {
    e.preventDefault()
    let {target} = e
    if (!target) {
      return
    }
    // debug('target drop', target)
    let fromTab = JSON.parse(e.dataTransfer.getData('fromFile'))
    let onDropTab = document.querySelector('.' + onDragOverCls)
    if (!onDropTab || !fromTab) {
      return
    }
    let dropId = onDropTab.getAttribute('data-id')
    if (!dropId || dropId === fromTab.id) {
      return
    }
    let {id} = fromTab
    let tabs = copy(this.props.store.tabs)
    let indexFrom = _.findIndex(tabs, t => t.id === id)
    let indexDrop = _.findIndex(tabs, t => t.id === dropId)
    if (indexDrop > indexFrom) {
      indexDrop = indexDrop - 1
    }
    tabs.splice(indexFrom, 1)
    tabs.splice(indexDrop, 0, fromTab)
    this.props.store.modifier({
      tabs
    })
  }

  reloadTab = async () => {
    let tab = copy(
      this.props.tab
    )
    let {id} = tab
    tab.id = generate()
    tab.status = newTerm().status
    let tabs = copy(this.props.store.tabs)
    let index = _.findIndex(tabs, t => t.id === id)
    tabs.splice(index, 1, tab)
    this.props.store.modifier({
      tabs,
      currentTabId: tab.id
    })
  }

  onDragEnd = e => {
    removeClass(this.dom, onDragCls)
    this.clearCls()
    e && e.dataTransfer && e.dataTransfer.clearData()
  }

  close = () => {
    this.props.onClose(this.props.tab.id)
    if (this.props.store.tabs.length <= 1) {
      setTimeout(this.add, 1)
    }
  }

  dup = () => {
    this.props.onDup(this.props.tab)
  }

  add = () => {
    this.props.onAdd()
  }

  doRename = () => {
    this.setState((s, props) => {
      return {
        isEditting: true,
        titleTemp: props.tab.title || ''
      }
    })
  }

  onBlur = (e) => {
    e.preventDefault()
    let tab = copy(this.props.tab)
    let {titleTemp} = this.state
    let {id, host} = tab
    if (!titleTemp && !host) {
      return message.warn(e('titleEmptyWarn'))
    }
    this.setState({
      isEditting: false
    })
    this.props.store.editTab(id, {title: titleTemp})
  }

  onChange = e => {
    let titleTemp = e.target.value
    this.setState({
      titleTemp
    })
  }

  closeOther = () => {
    this.props.store.modifier({
      tabs: [this.props.tab],
      currentTabId: this.props.tab.id
    })
  }

  closeTabsRight = () => {
    let {currentTabId} = this.props.store
    let tabs = copy(this.props.store.tabs)
    let {tab} = this.props
    let index = _.findIndex(tabs, t => t.id === tab.id)
    tabs = tabs.slice(0, index + 1)
    let update = {
      tabs
    }
    if (!_.some(tabs, t => t.id === currentTabId)) {
      update.currentTabId = tabs[0].id
    }
    this.props.modifier(update)
  }

  renderContext() {
    let tabs = copy(this.props.store.tabs)
    let {tab} = this.props
    let len = tabs.length
    let index = _.findIndex(tabs, t => t.id === tab.id)
    let nother = len === 1
    let noRight = index >= len - 1
    let cls = 'pd2x pd1y context-item pointer'
    return (
      <div>
        <div
          className={cls}
          onClick={this.close}
        >
          <Icon type="close" /> {e('close')}
        </div>
        {
          nother
            ? null
            : (
              <div
                className={cls}
                onClick={this.closeOther}
              >
                <Icon type="close" /> {e('closeOtherTabs')}
              </div>
            )
        }
        {
          noRight
            ? null
            : (
              <div
                className={cls}
                onClick={this.closeTabsRight}
              >
                <Icon type="close" /> {e('closeTabRight')}
              </div>
            )
        }

        <div
          className={cls}
          onClick={this.add}
        >
          <Icon type="code-o" /> {e('newTab')}
        </div>
        <div
          className={cls}
          onClick={this.dup}
        >
          <Icon type="copy" /> {e('duplicate')}
        </div>
        <div
          className={cls}
          onClick={this.doRename}
        >
          <Icon type="edit" /> {e('rename')}
        </div>
        <div
          className={cls}
          onClick={this.reloadTab}
        >
          <Icon type="loading-3-quarters" theme="outlined" /> {m('reload')}
        </div>
      </div>
    )
  }

  onContextMenu = e => {
    e.preventDefault()
    let {target} = e
    let rect = target.getBoundingClientRect()
    let content = this.renderContext()
    this.props.store.openContextMenu({
      contentRender: () => content,
      pos: {
        left: rect.left,
        top: rect.top + 20
      }
    })
  }

  renderEditting(cls) {
    let {
      titleTemp
    } = this.state
    return (
      <div className={cls + ' pd1x'}>
        <Input
          value={titleTemp}
          onChange={this.onChange}
          onBlur={this.onBlur}
          onPressEnter={this.onBlur}
        />
      </div>
    )
  }

  render() {
    let {
      currentTabId
    } = this.props.store
    let {
      onChange,
      onDup,
      tab
    } = this.props
    let {isEditting} = this.state
    let {id, status} = tab
    let active = id === currentTabId
    let cls = classnames('tab', {active}, status)
    let title = createName(tab)
    if (isEditting) {
      return this.renderEditting(cls)
    }
    return (
      <Tooltip
        title={title}
        placement="top"
      >
        <div
          className={cls}
          draggable
          id={'id' + id}
          data-id={id}
          {..._.pick(this, [
            'onDrag',
            'onDragEnter',
            'onDragExit',
            'onDragLeave',
            'onDragOver',
            'onDragStart',
            'onDrop',
            'onDragEnd'
          ])}
        >
          <div
            className="tab-title elli pd1x"
            onClick={() => onChange(id)}
            onDoubleClick={() => onDup(tab)}
            onContextMenu={this.onContextMenu}
          >
            <Badge status={status} />
            <Icon
              className="pointer tab-reload mg1r"
              type="loading-3-quarters"
              theme="outlined"
              onClick={this.reloadTab}
              title={m('reload')}
            />
            {title}
          </div>
          <Icon
            className="pointer tab-close"
            type="close-circle"
            theme="filled"
            onClick={this.close}
          />
        </div>
      </Tooltip>
    )
  }
}
