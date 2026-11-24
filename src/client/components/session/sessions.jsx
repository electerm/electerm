import { Component } from 'manate/react/class-components'
import Session from './session.jsx'

import { pick } from 'lodash-es'
import classNames from 'classnames'
import {
  termControlHeight
} from '../../common/constants.js'
import pixed from '../layout/pixed'

export default class Sessions extends Component {
  // Function to reload a tab using store.reloadTab
  reloadTab = (tab) => {
    window.store.updateTab(tab.id, tab)
    window.store.reloadTab(tab.id)
  }

  // Function to delete tab using store.delTab
  delTab = (id) => {
    window.store.delTab(id)
  }

  // Function to edit tab properties using store.editItem
  editTab = (id, update) => {
    window.store.updateTab(id, update)
  }

  computeHeight = (height) => {
    const {
      tabsHeight
    } = this.props
    return height -
      tabsHeight -
      (this.props.controlsHost ? 0 : termControlHeight)
  }

  computeSessionStyle = (batch) => {
    const style = this.props.styles[batch] || this.props.styles[0] || {}
    return pixed(style)
  }

  renderSessions () {
    const {
      config,
      tabs,
      activeTabId,
      sizes
    } = this.props
    const fallbackSize = sizes[0] || { height: 0, width: 0 }
    return tabs.map((tab) => {
      const { id, batch } = tab
      // MCP/AI-created tabs may carry an out-of-range or missing batch.
      // Never crash the whole UI on bad data — fall back to batch 0 size.
      const { height, width, sidebarWidth } = sizes[batch] || fallbackSize
      const currentBatchTabId = this.props['activeTabId' + batch]
      const cls = classNames(
        `session-wrap session-${id}`,
        {
          'session-current': id === activeTabId,
          'session-batch-active': id === currentBatchTabId
        }
      )
      const sessionWrapProps = {
        style: this.computeSessionStyle(batch),
        className: cls
      }
      const sessProps = {
        sftpPercent: this.props.sftpPercent,
        setSftpPercent: this.props.setSftpPercent,
        controlsHost: this.props.controlsHost,
        activeTabId,
        layout: this.props.layout,
        tab,
        width,
        sidebarWidth: tab.enableSsh === false ? 0 : sidebarWidth,
        height,
        ...pick(this.props, [
          'resolutions',
          'fileOperation',
          'pinnedQuickCommandBar',
          'tabsHeight',
          'appPath',
          'leftSidePanelWidth',
          'pinned',
          'openedSideBar',
          'fullscreen'
        ]),
        config,
        ...pick(this, [
          'reloadTab',
          'computeHeight',
          'delTab',
          'editTab'
        ]),
        currentBatchTabId
      }
      return (
        <div {...sessionWrapProps} key={id}>
          <Session
            {...sessProps}
          />
        </div>
      )
    })
  }

  render () {
    const { layoutStyle, tabs } = this.props
    if (!tabs || !tabs.length) {
      return null
    }
    const sessProps = {
      style: layoutStyle,
      className: 'sessions'
    }
    return (
      <div
        {...sessProps}
      >
        {this.renderSessions()}
      </div>
    )
  }
}
