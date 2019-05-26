
import { Component } from '../common/react-subx'
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

export default class Index extends Component {
  componentDidMount () {
    let { store } = this.props
    window.lang = copy(window.lang)
    window._config = copy(window._config)
    let title = createTitlte(store.tabs[0])
    window.getGlobal('setTitle')(title)
    window.addEventListener('resize', store.onResize)
    store.onResize()
    window._require('electron')
      .ipcRenderer
      .on('checkupdate', store.onCheckUpdate)
      .on('open-about', store.openAbout)
      .on('new-ssh', store.onNewSsh)
      .on('openSettings', store.openSetting)
      .on('selectall', store.selectall)
      .on('focused', store.focus)
    document.addEventListener('drop', function (e) {
      e.preventDefault()
      e.stopPropagation()
    })
    document.addEventListener('dragover', function (e) {
      e.preventDefault()
      e.stopPropagation()
    })
    store.checkLastSession()
    store.checkDefaultTheme()
    window.addEventListener('offline', store.setOffline)
    store.zoom(store.config.zoom, false, true)
  }

  render () {
    let { store } = this.props
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
    } = store
    let sessProps = _.pick(store, [
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
          store={store}
          upgradeInfo={store.upgradeInfo}
          addTab={store.addTab}
          shouldCheckUpdate={shouldCheckUpdate}
        />
        <ContextMenu
          {...contextMenuProps}
          visible={contextMenuVisible}
          closeContextMenu={store.closeContextMenu}
        />
        <SystemMenu store={store} />
        <FileInfoModal
          {...fileInfoModalProps}
        />
        <FileModeModal
          key={_.get(fileModeModalProps, 'file.id') || ''}
          {...fileModeModalProps}
        />
        <SettingModal store={store} />
        <div
          id='outside-context'
          style={{
            opacity: config.opacity
          }}
        >
          <Sidebar store={store} />
          <Tabs
            store={store}
            {..._.pick(store, [
              'currentTabId',
              'height',
              'width',
              'config',
              'activeTerminalId',
              'isMaximized'
            ])}
            tabs={copy(store.tabs)}
          />
          <div className='ui-outer'>
            {
              tabs.map((tab) => {
                let { id } = tab
                let cls = id !== currentTabId
                  ? 'hide'
                  : 'ssh-wrap-show'
                return (
                  <div className={cls} key={id}>
                    <Session
                      store={store}
                      tab={copy(tab)}
                      {..._.pick(store, [
                        'currentTabId',
                        'height',
                        'width',
                        'activeTerminalId'
                      ])}
                      config={copy(config)}
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
