
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
      modifier,
      config
    } = this.props.store
    let sessProps = _.pick(this.props.store, [
      'modifier', 'addTab', 'sessionModalVisible', 'selectedSessions'
    ])
    return (
      <div>
        <SessionControl {...sessProps} />
        <TextEditor
          key={textEditorProps.id}
          {...textEditorProps}
          modifier={modifier}
        />
        <UpdateCheck
          modifier={modifier}
          upgradeInfo={this.props.store.upgradeInfo}
          addTab={this.props.store.addTab}
          shouldCheckUpdate={shouldCheckUpdate}
        />
        <ContextMenu
          {...contextMenuProps}
          visible={contextMenuVisible}
          closeContextMenu={this.props.store.closeContextMenu}
        />
        <SystemMenu store={this.props.store} />
        <FileInfoModal
          {...fileInfoModalProps}
        />
        <FileModeModal
          key={_.get(fileModeModalProps, 'file.id') || ''}
          {...fileModeModalProps}
        />
        <SettingModal store={this.props.store} />
        <div
          id="outside-context"
          style={{
            opacity: config.opacity
          }}
        >
          <Sidebar store={this.props.store} />
          <Tabs
            store={this.props.store}
            {..._.pick(this.props.store, [
              'currentTabId', 'width', 'tabTitles'
            ])}
          />
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
                      store={this.props.store}
                      tab={copy(tab)}
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
