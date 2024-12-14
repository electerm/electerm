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
  handleClick = () => {
    window.store.currentTabId = this.props.tab.currentTabId
  }

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

  computeHeight = () => {
    const {
      tabsHeight
    } = this.props
    return this.props.height -
      tabsHeight -
      termControlHeight
  }

  computeSessionStyle = (tab) => {
    const { batch } = tab
    const style = this.props.styles[batch]
    return style
  }

  renderSessions () {
    const {
      config,
      width,
      height,
      batch,
      tabs,
      currentTabId
    } = this.props
    const currentBatchActiveTabId = this.props[currentTabId + batch]
    if (!tabs || !tabs.length) {
      return this.renderNoSession()
    }
    return tabs.map((tab) => {
      const { id, type } = tab
      const cls = classNames(
        `session-wrap session-${id}`,
        {
          'session-current': id === currentTabId,
          'session-batch-active': id === currentBatchActiveTabId
        }
      )
      const sessionWrapProps = {
        style: this.computeSessionStyle(tab),
        className: cls
      }
      if (type === terminalWebType) {
        const webProps = {
          tab,
          width,
          height: this.computeHeight(),
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
    return (
      <div
        className='sessions'
        onClick={this.handleClick}
      >
        {this.renderSessions()}
      </div>
    )
  }
}
