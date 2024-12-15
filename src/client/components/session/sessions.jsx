import { Component } from 'react'
import Session from './session.jsx'
import WebSession from '../web/web-session.jsx'
import { pick } from 'lodash-es'
import classNames from 'classnames'
import copy from 'json-deep-copy'
import {
  terminalWebType,
  termControlHeight
} from '../../common/constants.js'
import LogoElem from '../common/logo-elem.jsx'
import { Button } from 'antd'

const e = window.translate

export default class Sessions extends Component {
  handleNewTab = () => {
    window.store.addTab(undefined, undefined, this.props.batch)
  }

  handleNewSsh = () => {
    window.store.onNewSsh()
  }

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

  renderNoSession = () => {
    const props = {
      style: {
        height: this.props.height + 'px'
      }
    }
    return (
      <div className='no-sessions electerm-logo-bg' {...props}>
        <Button
          onClick={this.handleNewTab}
          size='large'
          className='mg1r mg1b add-new-tab-btn'
        >
          {e('newTab')}
        </Button>
        <Button
          onClick={this.handleNewSsh}
          size='large'
          className='mg1r mg1b'
        >
          {e('newBookmark')}
        </Button>
        <div className='pd3'>
          <LogoElem />
        </div>
      </div>
    )
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
    return style
  }

  renderSessions () {
    const {
      config,
      tabs,
      currentTabId,
      sizes
    } = this.props

    if (!tabs || !tabs.length) {
      return this.renderNoSession()
    }
    return tabs.map((tab) => {
      const { id, type, batch } = tab
      const { height, width } = sizes[batch]
      console.log('height, width', height, width)
      const currentBatchActiveTabId = this.props['currentTabId' + batch]
      console.log('currentBatchActiveTabId', currentBatchActiveTabId, tab, id, id === currentBatchActiveTabId)
      const cls = classNames(
        `session-wrap session-${id}`,
        {
          'session-current': id === currentTabId,
          'session-batch-active': id === currentBatchActiveTabId
        }
      )
      const sessionWrapProps = {
        style: this.computeSessionStyle(batch),
        className: cls
      }
      if (type === terminalWebType) {
        const webProps = {
          tab,
          width,
          height: this.computeHeight(height),
          ...pick(this, [
            'reloadTab'
          ])
        }
        return (
          <div {...sessionWrapProps} key={id}>
            <WebSession
              {...webProps}
            />
          </div>
        )
      }
      const sessProps = {
        currentTabId,
        tab: copy(tab),
        width,
        height,
        ...pick(this.props, [
          'batch',
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
        ])
      }
      return (
        <div className={cls} key={id}>
          <Session
            {...sessProps}
          />
        </div>
      )
    })
  }

  render () {
    const { layoutStyle } = this.props
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
