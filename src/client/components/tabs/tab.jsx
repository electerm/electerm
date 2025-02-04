/**
 * file section
 */

import { createRef } from 'react'
import { Component } from '../common/component'
import { refs } from '../common/ref'
import {
  CloseOutlined,
  Loading3QuartersOutlined,
  BorderlessTableOutlined
} from '@ant-design/icons'
import {
  Tooltip,
  message,
  Dropdown
} from 'antd'
import classnames from 'classnames'
import { pick } from 'lodash-es'
import Input from '../common/input-auto-focus'
import createName from '../../common/create-title'
import { addClass, removeClass } from '../../common/class'
import isDark from '../../common/is-color-dark'
import { action } from 'manate'
import iconsMap from '../sys-menu/icons-map.jsx'
import { shortcutDescExtend } from '../shortcuts/shortcut-handler.js'

const e = window.translate
const onDragCls = 'ondrag-tab'
const onDragOverCls = 'dragover-tab'

class Tab extends Component {
  state = {
    terminalOnData: false
  }

  tabRef = createRef()

  componentDidMount () {
    this.id = 'tab-' + this.props.tab.id
    refs.add(this.id, this)
    window.addEventListener('message', this.onEvent)
  }

  componentDidUpdate (prevProps) {
    if (this.props.openContextMenu && !prevProps.openContextMenu) {
      this.handleContextMenu()
    }
    if (this.props.contextFunc && !prevProps.contextFunc) {
      this[this.props.contextFunc](...this.props.contextArgs)
    }
  }

  componentWillUnmount () {
    refs.remove(this.id)
    clearTimeout(this.timer)
    this.timer = null
  }

  notifyOnData = () => {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.setState({
      terminalOnData: true
    })
    this.timer = setTimeout(this.clearTerminalOnData, 4000)
  }

  clearTerminalOnData = () => {
    this.setState({
      terminalOnData: false
    })
  }

  // shouldComponentUpdate (nextProps) {
  //   return this.shouldUpdate(this.props, nextProps)
  // }

  // shouldUpdate = (prevProps, nextProps) => {
  //   // todo activeTabId still need improve
  //   const pickKeys = [
  //     'activeTabId',
  //     'height',
  //     'isLast',
  //     'isMaximized',
  //     'config',
  //     'tab',
  //     'width',
  //     'openContextMenu',
  //     'contextFunc'
  //   ]

  //   // compare only the relevant props
  //   return !isEqual(pick(prevProps, pickKeys), pick(nextProps, pickKeys))
  // }

  clearCls = () => {
    document.querySelectorAll('.' + onDragOverCls).forEach((d) => {
      removeClass(d, onDragOverCls)
    })
  }

  handleClick = (e) => {
    window.store.clickTab(this.props.tab.id, this.props.batch)
  }

  onDrag = () => {
    addClass(this.tabRef.current, onDragCls)
  }

  onDragEnter = () => {
    this.clearCls()
    addClass(this.tabRef.current, onDragOverCls)
  }

  onDragExit = () => {
    // debug('ondragexit')
    // let {target} = e
    // removeClass(target, 'sftp-dragover')
  }

  onDragLeave = e => {
    // debug('ondragleave')
    const { target } = e
    removeClass(target, onDragOverCls)
  }

  onDragOver = e => {
    // debug('ondragover')
    // debug(e.target)
    // removeClass(this.tabRef.current, 'sftp-dragover')
    e.preventDefault()
  }

  onDragStart = e => {
    // debug('ondragstart')
    // debug(e.target)
    e.dataTransfer.setData('fromFile', JSON.stringify(this.props.tab))
    // e.effectAllowed = 'copyMove'
  }

  onDrop = e => {
    e.preventDefault()
    const { target } = e
    if (!target) {
      return
    }

    const fromTab = JSON.parse(e.dataTransfer.getData('fromFile'))
    let onDropTab = target
    while (onDropTab) {
      if (onDropTab.classList && onDropTab.classList.contains('tab')) {
        break
      }
      onDropTab = onDropTab.parentElement
    }
    if (!onDropTab || !fromTab) {
      return
    }

    const dropId = onDropTab.getAttribute('data-id')
    if (!dropId || dropId === fromTab.id) {
      return
    }

    const { id } = fromTab
    const storeTabs = window.store.tabs
    const indexFrom = storeTabs.findIndex(t => t.id === id)
    let indexDrop = storeTabs.findIndex(t => t.id === dropId)

    if (indexFrom >= 0 && indexDrop >= 0) {
      const targetTab = storeTabs[indexDrop]
      const fromBatch = fromTab.batch

      // Handle currentTab change if needed
      if (window.store[`activeTabId${fromBatch}`] === id && fromBatch !== targetTab.batch) {
        // Find next tab in the same batch
        const nextTab = storeTabs.find((t, i) =>
          i !== indexFrom && t.batch === fromBatch
        )
        window.store[`activeTabId${fromBatch}`] = nextTab ? nextTab.id : ''
      }

      // Reorder tabs and update batch
      action(function () {
        const [tab] = storeTabs.splice(indexFrom, 1)
        tab.batch = targetTab.batch // Update the batch to match target tab's batch
        if (indexFrom < indexDrop) {
          indexDrop = indexDrop - 1
        }
        storeTabs.splice(indexDrop, 0, tab)
      })()
      window.store.focus()
    }
  }

  handleReloadTab = async () => {
    window.store.reloadTab(this.props.tab.id)
  }

  onDragEnd = e => {
    removeClass(this.tabRef.current, onDragCls)
    this.clearCls()
    e && e.dataTransfer && e.dataTransfer.clearData()
  }

  handleClose = () => {
    window.store.delTab(this.props.tab.id)
  }

  handleDup = () => {
    window.store.duplicateTab(
      this.props.tab.id
    )
  }

  cloneToNextLayout = () => {
    window.store.cloneToNextLayout(this.props.tab)
  }

  newTab = () => {
    this.props.addTab()
  }

  doRename = () => {
    const { tab } = this.props
    tab.titleTemp = tab.title || ''
    tab.isEditting = true
  }

  handleBlur = () => {
    const { tab } = this.props
    const { titleTemp, title, host } = tab
    if (!titleTemp && !host) {
      return message.warning(e('titleEmptyWarn'))
    }
    delete tab.isEditting
    if (title === titleTemp) {
      delete tab.titleTemp
    }
    tab.title = titleTemp
  }

  handleChange = e => {
    const { tab } = this.props
    const titleTemp = e.target.value
    tab.titleTemp = titleTemp
  }

  closeOther = () => {
    window.store.closeOtherTabs(this.props.tab.id)
  }

  closeTabsRight = () => {
    window.store.closeTabsRight(this.props.tab.id)
  }

  renderContext = () => {
    const { tabs, tabIndex } = this.props
    const len = tabs.length
    const index = tabIndex
    const noRight = index >= len - 1
    const reloadShortcut = this.getShortcut('app_reloadCurrentTab')
    const closeShortcut = this.getShortcut('app_closeCurrentTab')
    const cloneToNextShortcut = this.getShortcut('app_cloneToNextLayout')

    const x = [
      {
        key: 'handleClose',
        icon: <iconsMap.CloseCircleOutlined />,
        label: e('close'),
        extra: closeShortcut
      },
      {
        key: 'closeOther',
        icon: <iconsMap.CloseCircleOutlined />,
        label: e('closeOtherTabs')
      },
      !noRight && {
        key: 'closeTabsRight',
        icon: <iconsMap.CloseCircleOutlined />,
        label: e('closeTabRight')
      },
      {
        key: 'newTab',
        icon: <iconsMap.CodeOutlined />,
        label: e('newTab')
      },
      {
        key: 'handleDup',
        icon: <iconsMap.CopyOutlined />,
        label: e('duplicate')
      },
      {
        key: 'cloneToNextLayout',
        icon: <iconsMap.CopyOutlined />,
        label: e('cloneToNextLayout'),
        extra: cloneToNextShortcut
      },
      {
        key: 'doRename',
        icon: <iconsMap.EditOutlined />,
        label: e('rename')
      },
      {
        key: 'handleReloadTab',
        icon: <iconsMap.ReloadOutlined />,
        label: e('reload'),
        extra: reloadShortcut
      }
    ].filter(Boolean)
    return x
  }

  onContextMenu = ({ key }) => {
    this[key]()
  }

  handleContextMenu = () => {
    const rect = this.tabRef.current.getBoundingClientRect()
    const items = this.renderContext()
    window.store.openContextMenu({
      items,
      pos: {
        left: rect.left,
        top: rect.top + 20
      },
      id: this.props.tab.id
    })
  }

  renderEditting (tab, cls) {
    const {
      titleTemp
    } = tab
    return (
      <div className={cls + ' pd1x'}>
        <Input
          value={titleTemp}
          onChange={this.handleChange}
          onBlur={this.handleBlur}
          onPressEnter={this.handleBlur}
        />
      </div>
    )
  }

  renderTitle = (sshTunnelResults, title) => {
    const list = sshTunnelResults.map(({ sshTunnel: obj, error }, i) => {
      const {
        sshTunnelLocalPort,
        sshTunnelRemoteHost = '127.0.0.1',
        sshTunnelRemotePort,
        sshTunnel,
        sshTunnelLocalHost = '127.0.0.1',
        name
      } = obj
      let tunnel
      if (sshTunnel === 'dynamicForward') {
        tunnel = `sock5://${sshTunnelLocalHost}:${sshTunnelLocalPort}`
      } else {
        tunnel = sshTunnel === 'forwardRemoteToLocal'
          ? `-> ${e('remote')}:${sshTunnelRemoteHost}:${sshTunnelRemotePort} -> ${sshTunnelLocalHost}:${sshTunnelLocalPort}`
          : `-> ${e('local')}:${sshTunnelLocalHost}:${sshTunnelLocalPort} -> ${sshTunnelRemoteHost}:${sshTunnelRemotePort}`
      }
      if (error) {
        tunnel = `error: ${tunnel}`
      }
      if (name) {
        tunnel = `[${name}] ${tunnel}`
      }
      return <div key={tunnel}>{tunnel}</div>
    })
    return (
      <div>
        <div>{title}</div>
        {list}
      </div>
    )
  }

  renderCloseIcon () {
    return (
      <span className='tab-close pointer'>
        <CloseOutlined onClick={this.handleClose} />
      </span>
    )
  }

  render () {
    const { isLast, tab, currentBatchTabId } = this.props
    const {
      id,
      isEditting,
      status,
      isTransporting,
      sshTunnelResults
    } = tab
    const {
      terminalOnData
    } = this.state
    const active = id === currentBatchTabId
    const cls = classnames(
      `tab-${id}`,
      'tab',
      { active },
      {
        'tab-last': isLast
      },
      status,
      {
        'is-terminal-active': terminalOnData
      },
      {
        'is-transporting': isTransporting
      }
    )
    const title = createName(tab)
    let tooltipTitle = title
    if (sshTunnelResults) {
      tooltipTitle = this.renderTitle(sshTunnelResults, title)
    }
    if (isEditting) {
      return this.renderEditting(tab, cls)
    }
    const dropdownProps = {
      menu: {
        items: this.renderContext(),
        onClick: this.onContextMenu
      },
      trigger: ['contextMenu']
    }
    const { tabCount, color = '#0088cc' } = tab
    const styleTag = color
      ? {
          background: color,
          color: isDark(color) ? '#fff' : '#000'
        }
      : {}
    return (
      <Tooltip
        title={tooltipTitle}
        placement='top'
      >
        <div
          className={cls}
          draggable
          ref={this.tabRef}
          data-id={id}
          {...pick(this, [
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
          <Dropdown {...dropdownProps}>
            <div
              className='tab-title elli pd1x'
              onClick={this.handleClick}
              onDoubleClick={this.handleDup}
            >
              <Loading3QuartersOutlined
                className='pointer tab-reload mg1r'
                onClick={this.handleReloadTab}
                title={e('reload')}
              />
              <span className='tab-title'>
                <span className='iblock mg1r tab-count' style={styleTag}>{tabCount}</span>
                <span className='mg1r'>{title}</span>
              </span>
            </div>
          </Dropdown>
          <div className={'tab-status ' + status} />
          <div className='tab-traffic' />
          <BorderlessTableOutlined className='tab-terminal-feed' />
          {
            this.renderCloseIcon()
          }
        </div>
      </Tooltip>
    )
  }
}

export default shortcutDescExtend(Tab)
