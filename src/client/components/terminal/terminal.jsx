import { Component, createRef } from 'react'
import { isEqual, pick } from 'lodash-es'
import {
  Spin,
  Dropdown,
  Button
} from 'antd'
import classnames from 'classnames'
import './terminal.styl'
import {
  paneMap,
  connectionMap
} from '../../common/constants.js'
import {
  AimOutlined
} from '@ant-design/icons'
import { refs } from '../common/ref.js'
import NormalBuffer from './normal-buffer.jsx'
import createDefaultLogPath from '../../common/default-log-path.js'
import SearchResultBar from './terminal-search-bar'
import RemoteFloatControl from '../common/remote-float-control'
import ReconnectOverlay from './reconnect-overlay.jsx'
import TerminalErrorHandle from './terminal-error-handle.jsx'
import DropFileModal from './drop-file-modal.jsx'
import { StartupQueue } from './startup-queue.js'
import { detectRemoteShell } from './shell-detect.js'
import { shortcutExtend, shortcutDescExtend } from '../shortcuts/shortcut-handler.js'
import { applyMixins } from './mixins/index.js'
import { initMixin } from './mixins/term-init.js'
import { resizeMixin } from './mixins/term-resize.js'
import { themeMixin } from './mixins/term-theme.js'
import { attachMixin } from './mixins/term-attach.js'
import { socketMixin } from './mixins/term-socket.js'
import { configMixin } from './mixins/term-config.jsx'
import { contextMenuMixin } from './mixins/term-context-menu.jsx'
import { contentMixin } from './mixins/term-content.js'
import { logMixin } from './mixins/term-log.jsx'
import { touchMixin } from './mixins/term-touch.js'
import { fileDropMixin } from './mixins/term-file-drop.js'
import { suggestionsMixin } from './mixins/term-suggestions.js'

const e = window.translate

// The terminal behaviour, grouped by concern - see ./mixins/index.js
const mixins = [
  initMixin,
  resizeMixin,
  themeMixin,
  attachMixin,
  socketMixin,
  configMixin,
  contextMenuMixin,
  contentMixin,
  logMixin,
  touchMixin,
  fileDropMixin,
  suggestionsMixin
]

class Term extends Component {
  constructor (props) {
    super(props)
    applyMixins(this, mixins)
    this.state = {
      loading: false,
      hasSelection: false,
      saveTerminalLogToFile: !!this.props.config.saveTerminalLogToFile,
      addTimeStampToTermLog: !!this.props.config.addTimeStampToTermLog,
      logPath: this.props.config.sessionLogPath || createDefaultLogPath(),
      logFileName: '',
      recording: false,
      recordingFilePath: '',
      passType: 'password',
      lines: [],
      searchResults: [],
      matchIndex: -1,
      totalLines: 0,
      reconnectCountdown: null,
      terminalError: null,
      dropFileModalVisible: false,
      droppedFiles: [],
      fontSizeChanged: false
    }
    this.id = `term-${this.props.tab.id}`
    refs.add(this.id, this)
    this.currentInput = ''
    // Owns the shell integration injection + cd + runScripts sequence.
    this.startupQueue = new StartupQueue(this, { detectRemoteShell })
  }

  domRef = createRef()

  timers = {}

  // Config keys that cannot be applied by a re-render - they are pushed into
  // the live xterm options instead.
  terminalConfigProps = [
    {
      name: 'rightClickSelectsWord',
      type: 'glob'
    },
    {
      name: 'fontSize',
      type: 'glob_local'
    },
    {
      name: 'fontFamily',
      type: 'glob_local'
    }
  ]

  // ---- Mobile touch support ----
  longPressTimer = null
  touchStartPos = null
  longPressFired = false
  longPressThreshold = 500 // ms
  longPressMoveTolerance = 10 // px

  terminalColorQueryDisposables = []

  componentDidMount () {
    // xterm and every addon are dynamic imports: a failed chunk fetch would
    // otherwise end as a silent unhandled rejection with a permanently blank
    // terminal pane
    this.initTerminal().catch(e => {
      console.error(e)
      this.handleError({ message: e.message })
    })
    if (this.props.tab.enableSsh === false) {
      this.props.tab.pane = paneMap.fileManager
    }
  }

  componentDidUpdate (prevProps) {
    const shouldChange = (
      prevProps.currentBatchTabId !== this.props.currentBatchTabId &&
      this.props.tab.id === this.props.currentBatchTabId &&
      this.props.pane === paneMap.terminal
    ) || (
      this.props.pane !== prevProps.pane &&
      this.props.pane === paneMap.terminal
    )
    const names = [
      'width',
      'height',
      'left',
      'top'
    ]
    if (
      !isEqual(
        pick(this.props, names),
        pick(prevProps, names)
      )
    ) {
      this.onResize()
    }
    if (shouldChange && this.term) {
      this.term.focus()
      // 标签从 display:none 变为可见时，延迟到下一动画帧再 fit，读取正确布局
      // 尺寸纠正列数；并用 refresh 强制重绘，清除快速连续打开多个连接时隐藏
      // 标签被 0 列 fit 导致的虚假/重复提示符。
      requestAnimationFrame(() => {
        if (this.term && !this.onClose) {
          this.fitAndRefresh()
          setTimeout(() => this.fitAndRefresh(), 80)
        }
      })
    }
    this.checkConfigChange(
      prevProps,
      this.props
    )
    if (
      prevProps.tab?.triggers !== this.props.tab?.triggers &&
      this.triggerManager
    ) {
      this.refreshTriggers()
    }
    const themeChanged = !isEqual(
      this.props.themeConfig,
      prevProps.themeConfig
    )
    // Also detect theme ID changes. Two different themes might share the
    // same terminal colour config but have different UI colours (--main),
    // which means the WebGL background needs to change even though
    // themeConfig (terminal colours) is identical.
    const themeIdChanged = prevProps.config?.theme !== this.props.config?.theme
    if ((themeChanged || themeIdChanged) && this.term) {
      this.registerTerminalColorQueryHandlers(this.term, this.props.themeConfig)
      this.applyTerminalTheme(true)
    }
  }

  componentWillUnmount () {
    refs.remove(this.id)
    clearTimeout(this.longPressTimer)
    this.longPressTimer = null
    this.touchStartPos = null
    if (window.store.activeTerminalId === this.props.tab.id) {
      window.store.activeTerminalId = ''
    }
    if (this.term) {
      this.term.parent = null
    }
    this.disposeTerminalColorQueryHandlers()
    this.startupQueue?.dispose()
    try {
      this._notifyOnDataDebounced?.cancel?.()
    } catch (_) {}
    this._notifyOnDataDebounced = null
    window.cancelAnimationFrame(this.timers.themeRaf)
    this.timers.themeRaf = null
    Object.keys(this.timers).forEach(k => {
      clearTimeout(this.timers[k])
      clearInterval(this.timers[k])
      this.timers[k] = null
    })
    this.onClose = true
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
    if (this.attachAddon) {
      try {
        this.attachAddon.dispose?.()
      } catch (_) {}
      this.attachAddon = null
    }
    if (this.term) {
      this.term.dispose()
      this.term = null
    }
    this.disposeTriggerManager?.()
    this.fitAddon = null
    this.zmodemClient = null
    this.trzszClient = null
    this.xmodemClient = null
    this.searchAddon = null
    this.fitAddon = null
    this.cmdAddon = null
    this.serializeAddon = null
    this.imageAddon = null
    this.webglContextLossDisposable?.dispose?.()
    this.webglContextLossDisposable = null
    try {
      this.webglAddon?.dispose?.()
    } catch (_) {}
    this.webglAddon = null
    this.webglRecovering = false
  }

  // ---- small helpers other mixins build on ----

  getDomId () {
    return `term-${this.props.tab.id}`
  }

  isActiveTerminal () {
    return this.props.tab.id === this.props.activeTabId &&
    this.props.tab.pane === paneMap.terminal
  }

  isRemote () {
    return this.props.tab?.host
  }

  isSsh () {
    const { host, type } = this.props.tab
    return host && (type === 'ssh' || type === undefined)
  }

  isLocal () {
    const { host, type } = this.props.tab
    return !host &&
      (type === 'local' || type === undefined)
  }

  setStatus = status => {
    const id = this.props.tab?.id
    this.props.editTab(id, {
      status
    })
  }

  renderResetFontSizeButton () {
    if (!this.state.fontSizeChanged) {
      return null
    }
    const txt = `${e('reset')} ${e('fontSize')}`
    return (
      <Button
        className='terminal-fontsize-reset'
        onClick={this.handleResetFontSize}
        type='default'
        size='small'
        title={txt}
        icon={<AimOutlined />}
      />
    )
  }

  render () {
    const { loading } = this.state
    const { height, width, left, top, fullscreen } = this.props
    const { id } = this.props.tab
    const isActive = this.isActiveTerminal()
    const cls = classnames(
      'term-wrap',
      'tw-' + id,
      {
        'terminal-not-active': !isActive
      }
    )
    const prps1 = {
      className: cls,
      style: {
        height,
        width,
        left,
        top,
        zIndex: 10
      },
      onDrop: this.onDrop,
      onContextMenu: this.onContextMenuInner,
      onTouchStart: this.onTouchStart,
      onTouchMove: this.onTouchMove,
      onTouchEnd: this.onTouchEnd
    }
    // const fileProps = {
    //   type: 'file',
    //   multiple: true,
    //   id: `${id}-file-sel`,
    //   className: 'hide'
    // }
    const prps3 = {
      id: this.getDomId(),
      ref: this.domRef,
      className: 'absolute term-wrap-2',
      style: {
        left: 0,
        top: 0,
        right: 0,
        bottom: 0
      }
    }
    const dropdownProps = {
      menu: {
        items: this.renderContextMenu(),
        onClick: this.onContextMenu
      },
      trigger: this.props.config.pasteWhenContextMenu ? [] : ['contextMenu']
    }
    const barProps = {
      matchIndex: this.state.matchIndex,
      matches: this.state.searchResults,
      totalLines: this.state.totalLines,
      height
    }
    const spin = loading ? <Spin className='loading-wrapper' spinning={loading} /> : null
    return (
      <Dropdown {...dropdownProps}>
        <div
          {...prps1}
        >
          <div
            {...prps3}
          />
          <NormalBuffer
            lines={this.state.lines}
            close={this.closeNormalBuffer}
          />
          <SearchResultBar {...barProps} />
          <RemoteFloatControl
            isFullScreen={fullscreen}
          />
          <TerminalErrorHandle
            errorMessage={this.state.terminalError?.message}
            showEditBookmarkButton={this.state.terminalError?.from === 'bookmarks' && !!this.state.terminalError?.srcId}
            onEditBookmark={this.handleEditBookmarkFromError}
          />
          <ReconnectOverlay
            countdown={this.state.reconnectCountdown}
          />
          {this.renderResetFontSizeButton()}
          <DropFileModal
            visible={this.state.dropFileModalVisible}
            files={this.state.droppedFiles}
            isSerial={this.props.tab?.type === connectionMap.serial}
            onSelect={this.handleDropFileAction}
            onCancel={this.handleDropFileModalCancel}
          />
          {spin}
        </div>
      </Dropdown>
    )
  }
}

export default shortcutDescExtend(shortcutExtend(Term))
