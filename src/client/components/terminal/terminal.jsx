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
import SessionStatusOverlay from './session-status-overlay.jsx'
import TerminalErrorHandle from './terminal-error-handle.jsx'
import DropFileModal from './drop-file-modal.jsx'
import TerminalSelectText from './terminal-select-text.jsx'
import { StartupQueue } from './startup-queue.js'
import { detectRemoteShell } from './shell-detect.js'
import { shortcutExtend, shortcutDescExtend } from '../shortcuts/shortcut-handler.js'
import { applyMixins } from './mixins/index.js'
import { initMixin } from './mixins/term-init.js'
import { resizeMixin } from './mixins/term-resize.js'
import { themeMixin } from './mixins/term-theme.js'
import { attachMixin } from './mixins/term-attach.js'
import { socketMixin } from './mixins/term-socket.js'
import { clearNeedsInteractiveInput } from './interactive-prompt-state.js'
import { configMixin } from './mixins/term-config.jsx'
import { contextMenuMixin } from './mixins/term-context-menu.jsx'
import { contentMixin } from './mixins/term-content.js'
import { logMixin } from './mixins/term-log.jsx'
import { touchMixin } from './mixins/term-touch.js'
import { fileDropMixin } from './mixins/term-file-drop.js'
import { suggestionsMixin } from './mixins/term-suggestions.js'
import { shouldOpenContextMenu } from '../../common/right-click-behavior.js'
import { logTerminalRender } from './terminal-render-diagnostics.mjs'
import {
  getWebglCircuitSnapshot,
  subscribeWebglCircuit
} from './terminal-webgl-circuit-breaker.mjs'

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
      // True once this pane has no live session (socket closed, or the session
      // failed to start). Not derivable from tab.status: store.updateTab mutates
      // the tab in place, and nothing in this component's ancestor chain reads
      // tab.status during render, so a status change does not re-render the
      // pane. Setting it here is also what triggers that render.
      sessionStopped: false,
      terminalError: null,
      dropFileModalVisible: false,
      droppedFiles: [],
      fontSizeChanged: false,
      // touch-only: the buffer snapshot shown by the select-text overlay
      selectTextVisible: false,
      selectTextContent: ''
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
      name: 'mouseEventsRequireAlt',
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

  // ---- Mobile touch support (behaviour lives in mixins/term-touch.js) ----
  // Only used while store.isTouchDevice is true, so a mouse-driven desktop
  // never touches any of it. Per-instance state has to stay a class field
  // here — a mixin may only export functions, see ./mixins/index.js.
  longPressTimer = null
  touchStartPos = null
  longPressFired = false
  longPressThreshold = 500 // ms
  // a finger drifts further than a mouse while holding still, so the tolerance
  // is looser than the old 10px to stop long presses being read as scrolls
  longPressMoveTolerance = 12 // px
  // { anchor: {col, absRow}, moved, clientX, clientY, target } while a
  // long-press selection is being dragged out
  dragSelect = null
  lastDragTouch = null
  autoScrollDir = 0
  dragFrame = 0
  tapCount = 0
  lastTapTime = 0
  lastTapPos = null
  // the read-only textarea of the select-text overlay
  selectTextRef = createRef()

  terminalColorQueryDisposables = []

  // ---- Renderer (DOM / WebGL) lifecycle (behaviour lives in
  // mixins/term-theme.js). The controller instance owns renderer selection; the
  // plain fields below are the owner-side mirror the diagnostics module reads,
  // so they must stay in sync through setupRendererLifecycle().
  rendererLifecycle = null
  rendererState = 'DOM'
  rendererGeneration = 0
  rendererLifecycleReady = false
  webglCircuitDisposable = null
  webglCircuitState = 'HEALTHY'
  // 激活失败（动态 import / addon 构造 / loadAddon 抛错）后置 true，与熔断一起
  // 阻断后续 WebGL 目标选择；只在用户显式 DOM→WebGL 配置切换时复位。
  webglActivationFailed = false

  componentDidMount () {
    // 订阅要最先建立：熔断可能在初始化过程中就发生。回调只同步状态并请求
    // reconcile，绝不触碰 socket/term 生命周期。
    this.webglCircuitState = getWebglCircuitSnapshot().state
    this.webglCircuitDisposable = subscribeWebglCircuit(event => {
      this.webglCircuitState = event.snapshot.state
      // 'tripped' 与 'reset' 必须给出不同的 reason：reset 由用户在设置里执行
      // DOM→WebGL 切换触发，是一次成功的用户操作，把它记成 'circuit tripped'
      // 会污染这个功能最需要读的那段日志。两个字符串都在诊断白名单里
      // （terminal-render-diagnostics.mjs 的 allowedReasons），不在白名单里会
      // fail-closed 静默丢字段。
      const reason = event.type === 'tripped' ? 'circuit tripped' : 'circuit reset'
      if (event.type === 'tripped') {
        logTerminalRender(this, 'webgl-circuit-tripped', { reason })
      }
      // controller 的释放失败会沿 promise 抛出，这里必须自行收尾
      this.reconcileRenderer(reason)
        .catch(error => console.error('renderer reconcile failed', error))
    })
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
      // The terminal just became visible. Revalidate its GPU glyph textures as
      // well as its layout; fit/refresh alone cannot recover a silently lost
      // WebGL atlas texture whose CPU-side version is unchanged.
      this.onWindowFocus(true, 'tab-visible')
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
    // 每次 React 提交后都协调一次可见性，且必须是无条件调用：刚隐藏的 tab
    // 即使 shouldChange 为 false（上面只负责给刚显示的终端 onWindowFocus），
    // 也要在这里因为 clientWidth/clientHeight 归零而同步释放 WebGL。
    // terminal 尚未就绪时 reconcileRenderer 自行安全返回。
    this.reconcileRenderer('component update')
      .catch(error => console.error('renderer reconcile failed', error))
  }

  componentWillUnmount () {
    // Renderer lifecycle first: it must stop reacting (and stop holding the
    // GPU context) before the terminal and socket it only borrows go away.
    // 只释放 renderer 资源：socket.close()/term.dispose() 仍由下方既有清理负责。
    this.onClose = true
    this.rendererLifecycleReady = false
    this.webglCircuitDisposable?.dispose?.()
    this.webglCircuitDisposable = null
    this.rendererLifecycle?.dispose('unmount')
      ?.catch?.(error => console.error('renderer dispose failed', error))
    this.rendererLifecycle = null
    refs.remove(this.id)
    // this tab id will never be connected again (reload mints a new one)
    clearNeedsInteractiveInput(this.props.tab.id)
    window.cancelAnimationFrame(this.timers.focusRefreshRaf)
    this.timers.focusRefreshRaf = null
    clearTimeout(this.longPressTimer)
    this.longPressTimer = null
    this.touchStartPos = null
    this.stopAutoScroll()
    window.cancelAnimationFrame(this.dragFrame)
    this.dragFrame = 0
    this.dragSelect = null
    this.lastDragTouch = null
    this.lastTapPos = null
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
    this.webglAddon = null
    this.webglContextLossDisposable = null
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

  isTelnet () {
    return this.props.tab?.type === connectionMap.telnet
  }

  isSerial () {
    return this.props.tab?.type === connectionMap.serial
  }

  isShellTerminal () {
    const { type } = this.props.tab || {}
    if (!type) {
      return true
    }
    return (
      type === connectionMap.ssh ||
      type === connectionMap.local ||
      type === connectionMap.telnet ||
      type === connectionMap.serial
    )
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
      // only 'context' opens the menu; 'paste' and 'passthrough' are handled
      // by onContextMenuInner (see term-context-menu.jsx)
      trigger: shouldOpenContextMenu(this.props.config) ? ['contextMenu'] : []
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
          <SessionStatusOverlay
            // Shown for a failed start too, not just a broken one: the error
            // alert says what went wrong, these are the way out of it. The two
            // do not stack - the alert is pinned to the top of the pane and
            // this one is centred, so the message stays readable.
            stopped={this.state.sessionStopped}
            countdown={this.state.reconnectCountdown}
            reloadShortcut={this.getShortcut('app_reloadCurrentTab')}
            closeShortcut={this.getShortcut('app_closeCurrentTab')}
            onReload={this.handleReloadStoppedSession}
            onClose={this.handleCloseStoppedSession}
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
          <TerminalSelectText
            visible={this.state.selectTextVisible}
            text={this.state.selectTextContent}
            textareaRef={this.selectTextRef}
            onSelectAll={this.handleSelectTextAll}
            onCopy={this.handleSelectTextCopy}
            onClose={this.handleSelectTextClose}
          />
        </div>
      </Dropdown>
    )
  }
}

export default shortcutDescExtend(shortcutExtend(Term))
