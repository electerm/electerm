import { Component } from '../common/component'
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
      termControlHeight
  }

  computeSessionStyle = (batch) => {
    const style = this.props.styles[batch]
    return pixed(style)
  }

  renderSessions () {
    const {
      config,
      tabs,
      activeTabId,
      sizes
    } = this.props
    return tabs.map((tab) => {
      const { id, batch } = tab
      const { height, width } = sizes[batch]
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
        activeTabId,
        tab,
        width,
        height,
        ...pick(this.props, [
          'resolutions',
          'hideDelKeyTip',
          'fileOperation',
          'pinnedQuickCommandBar',
          'tabsHeight',
          'appPath',
          'leftSidebarWidth',
          'pinned',
          'openedSideBar'
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
