
import React from 'react'
import Session from '../session'
import Tabs from '../tabs'
import _ from 'lodash'
import copy from 'json-deep-copy'
import ContextMenu from '../common/context-menu'
import FileInfoModal from '../sftp/file-props-modal'
import FileModeModal from '../sftp/file-mode-modal'
import UpdateCheck from './upgrade'
import SettingModal from '../setting-panel/setting-modal'
import createTitlte from '../../common/create-title'
import TextEditor from '../text-editor'
import Sidebar from '../sidebar'
import SystemMenu from './system-menu'
import SessionControl from '../session-control'
import './wrapper.styl'

export default class Index extends React.Component {

  componentDidMount() {
    window.lang = copy(window.lang)
    window._config = copy(window._config)
    let title = createTitlte(this.props.store.tabs[0])
    window.getGlobal('setTitle')(title)
    window.addEventListener('resize', this.store.onResize)
    this.onResize()
    window._require('electron')
      .ipcRenderer
      .on('checkupdate', this.store.onCheckUpdate)
      .on('open-about', this.store.openAbout)
      .on('new-ssh', this.store.onNewSsh)
      .on('openSettings', this.store.openSetting)
      .on('selectall', this.store.selectall)
      .on('focused', this.store.focus)
    document.addEventListener('drop', function(e) {
      e.preventDefault()
      e.stopPropagation()
    })
    document.addEventListener('dragover', function(e) {
      e.preventDefault()
      e.stopPropagation()
    })
    this.checkLastSession()
    this.checkDefaultTheme()
    window.addEventListener('offline',  this.store.setOffline)
    this.zoom(this.props.store.config.zoom, false, true)
  }

  render() {
    let {
      tabs,
      currentTabId,
      contextMenuProps,
      contextMenuVisible,
      fileInfoModalProps,
      fileModeModalProps,
      shouldCheckUpdate,
      textEditorProps,
      config
    } = this.state
    let {themes, theme} = this.state
    let themeConfig = (_.find(themes, d => d.id === theme) || {}).themeConfig || {}
    let controlProps = {
      ...this.state,
      list: this.getList(),
      themeConfig,
      ..._.pick(this, [
        'modifier', 'delTab', 'addTab', 'editTab',
        'openTransferHistory',
        'clearTransferHistory',
        'closeTransferHistory',
        'addTransferHistory',
        'onError', 'openContextMenu',
        'modifyLs', 'addItem', 'editItem', 'delItem',
        'onCheckUpdate', 'openAbout',
        'setTheme', 'addTheme', 'editTheme', 'delTheme',
        'addBookmarkGroup',
        'editBookmarkGroup',
        'closeContextMenu',
        'zoom',
        'clickNextTab',
        'openMenu',
        'closeMenu',
        'delBookmarkGroup',
        'onClose',
        'reloadTab',
        'hideModal', 'onDelItem',
        'onNewSsh', 'openSetting', 'onEditHistory',
        'openTerminalThemes',
        'onSelectHistory', 'onChangeTabId', 'onDuplicateTab', 'onSelectBookmark', 'onChangeTab'
      ])
    }
    let sessProps = {
      ..._.pick(this, [
        'modifier', 'addTab'
      ]),
      ..._.pick(this.state, [
        'sessionModalVisible',
        'selectedSessions'
      ])
    }
    return (
      <div>
        <SessionControl {...sessProps} />
        <TextEditor
          key={textEditorProps.id}
          {...textEditorProps}
          modifier={this.modifier}
        />
        <UpdateCheck
          modifier={this.modifier}
          upgradeInfo={this.state.upgradeInfo}
          addTab={this.addTab}
          shouldCheckUpdate={shouldCheckUpdate}
        />
        <ContextMenu
          {...contextMenuProps}
          visible={contextMenuVisible}
          closeContextMenu={this.closeContextMenu}
        />
        <SystemMenu {...controlProps} />
        <FileInfoModal
          {...fileInfoModalProps}
        />
        <FileModeModal
          key={_.get(fileModeModalProps, 'file.id') || ''}
          {...fileModeModalProps}
        />
        <SettingModal {...controlProps} />
        <div
          id="outside-context"
          style={{
            opacity: config.opacity
          }}
        >
          <Sidebar {...controlProps} />
          <Tabs {...controlProps} />
          <div className="ui-outer">
            {
              tabs.map((tab) => {
                let {id} = tab
                let cls = id !== currentTabId
                  ? 'hide'
                  : 'ssh-wrap-show'
                return (
                  <div className={cls} key={id}>
                    <Session
                      {...controlProps}
                      tab={tab}
                    />
                  </div>
                )
              })
            }
          </div>
        </div>
      </div>
    )
  }

}
