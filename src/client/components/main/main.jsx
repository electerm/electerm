
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
import CssOverwrite from './css-overwrite'
import UiTheme from './ui-theme'
import classnames from 'classnames'
import { isMac, isWin } from '../../common/constants'
import './wrapper.styl'

export default class Index extends Component {
  componentDidMount () {
    const { store } = this.props
    window.lang = copy(window.lang)
    window._config = copy(window._config)
    const title = createTitlte(store.tabs[0])
    window.pre.runGlobalAsync('setTitle', title)
    window.addEventListener('resize', store.onResize)
    store.onResize()
    const { ipcOnEvent } = window.pre
    ipcOnEvent('checkupdate', store.onCheckUpdate)
    ipcOnEvent('open-about', store.openAbout)
    ipcOnEvent('new-ssh', store.onNewSsh)
    ipcOnEvent('openSettings', store.openSetting)
    ipcOnEvent('selectall', store.selectall)
    ipcOnEvent('focused', store.focus)

    document.addEventListener('drop', function (e) {
      e.preventDefault()
      e.stopPropagation()
    })
    document.addEventListener('dragover', function (e) {
      e.preventDefault()
      e.stopPropagation()
    })
    window.addEventListener('offline', store.setOffline)
    store.zoom(store.config.zoom, false, true)
    store.initData()
  }

  render () {
    const { store } = this.props
    const {
      tabs,
      currentTabId,
      contextMenuProps,
      contextMenuVisible,
      fileInfoModalProps,
      fileModeModalProps,
      textEditorProps,
      storeAssign,
      config
    } = store
    // const sessProps = _.pick(store, [
    //   'storeAssign', 'addTab', 'sessionModalVisible', 'selectedSessions'
    // ])
    const cls = classnames({
      'is-mac': isMac,
      'is-win': isWin
    })
    const ext1 = {
      className: cls
    }
    const cpConf = copy(config)
    const confsCss = Object
      .keys((cpConf))
      .filter(d => d.startsWith('terminalBackground'))
      .reduce((p, k) => {
        return {
          ...p,
          [k]: cpConf[k]
        }
      }, {})
    const themeProps = {
      themeConfig: store.getUiThemeConfig()
    }
    const updateProps = {
      upgradeInfo: copy(store.upgradeInfo)
    }
    const outerProps = {
      style: {
        opacity: config.opacity
      }
    }
    const tabsProps = {
      ..._.pick(store, [
        'currentTabId',
        'height',
        'width',
        'config',
        'activeTerminalId',
        'isMaximized'
      ]),
      tabs: copy(store.tabs)
    }
    return (
      <div {...ext1}>
        <CssOverwrite {...confsCss} />
        <UiTheme
          {...themeProps}
          buildTheme={store.buildTheme}
        />
        <TextEditor
          key={textEditorProps.id}
          {...textEditorProps}
          storeAssign={storeAssign}
        />
        <UpdateCheck
          store={store}
          {...updateProps}
          addTab={store.addTab}
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
          {...outerProps}
        >
          <Sidebar store={store} />
          <Tabs
            store={store}
            {...tabsProps}
          />
          <div className='ui-outer'>
            {
              tabs.map((tab) => {
                const { id } = tab
                const cls = id !== currentTabId
                  ? 'hide'
                  : 'ssh-wrap-show'
                const tabProps = {
                  tab: copy(tab),
                  ..._.pick(store, [
                    'currentTabId',
                    'height',
                    'width',
                    'activeTerminalId'
                  ]),
                  config: cpConf
                }
                return (
                  <div className={cls} key={id}>
                    <Session
                      store={store}
                      {...tabProps}
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
