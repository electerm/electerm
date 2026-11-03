import {
  loadTerminal,
  loadFitAddon,
  loadSerializeAddon,
  loadSearchAddon,
  loadLigaturesAddon,
  loadUnicode11Addon,
  loadImageAddon
} from '../xterm-loader.js'
import { CommandTrackerAddon } from '../command-tracker-addon.js'
import { Osc52Addon } from '../osc52-addon.js'
import { rendererTypes } from '../../../common/constants.js'
import { refsStatic } from '../../common/ref.js'
import keyControlPressed from '../../../common/key-control-pressed.js'

/**
 * Terminal bootstrap: create the xterm instance, load every addon and wire
 * the handlers that must exist before the connection is opened. Connection
 * setup continues in `socketMixin.remoteInit`.
 */
export const initMixin = {
  async initTerminal () {
    const { themeConfig, tab = {}, config = {} } = this.props
    // 初始一律使用内置 DOM renderer 的主题：terminal 先以 DOM 起步，WebGL
    // 由 lifecycle controller 在真正可见后惰性激活并重新套用主题。
    const tc = this.getRendererThemeConfig(themeConfig, rendererTypes.dom)
    const Terminal = await loadTerminal()
    const term = new Terminal({
      allowProposedApi: true,
      scrollback: config.scrollback,
      rightClickSelectsWord: config.rightClickSelectsWord || false,
      mouseEventsRequireAlt: config.mouseEventsRequireAlt || false,
      fontFamily: tab.fontFamily || config.fontFamily,
      theme: tc,
      allowTransparency: true,
      wordSeparator: config.terminalWordSeparator,
      cursorStyle: config.cursorStyle,
      cursorBlink: config.cursorBlink,
      fontSize: tab.fontSize || config.fontSize,
      screenReaderMode: config.screenReaderMode
    })

    term.parent = this
    term.onSelectionChange(this.onSelection)
    term.open(this.domRef.current, true)
    this.registerTerminalColorQueryHandlers(term, themeConfig)
    this.fixSelectionColors(term)
    // 这里不再按 config.rendererType 二次套用主题：所有终端都以 DOM renderer
    // 起步，WebGL 主题只在 lifecycle controller 真正激活 WebGL 时才由
    // activateVisibleWebglRenderer 套上；在初始期套 WebGL 主题会和上面的 DOM
    // 主题互相矛盾。

    const FitAddon = await loadFitAddon()
    this.fitAddon = new FitAddon()
    this.cmdAddon = new CommandTrackerAddon()
    const SerializeAddon = await loadSerializeAddon()
    this.serializeAddon = new SerializeAddon()
    this.cmdAddon.onCommandExecuted((cmd) => {
      if (cmd && cmd.trim()) {
        window.store.addCmdHistory(cmd.trim())
      }
    })
    this.cmdAddon.onCwdChanged((cwd) => {
      this.setCwd(cwd)
    })
    // A fresh prompt (OSC 633;A) proves the shell is still alive, so an
    // earlier `exit` only left a nested shell. Dropping the exit latch here
    // keeps the next real disconnect from closing the tab (#4629). Shells
    // without integration are covered by `exitCloseWindow` instead.
    this.cmdAddon.onPrompt(() => this.clearUserTypeExit())
    const SearchAddon = await loadSearchAddon()
    this.searchAddon = new SearchAddon()
    const LigaturesAddon = await loadLigaturesAddon()
    const ligtureAddon = new LigaturesAddon()
    this.searchAddon.onDidChangeResults(this.onSearchResultsChange)
    const Unicode11Addon = await loadUnicode11Addon()
    const unicode11Addon = new Unicode11Addon()
    term.loadAddon(unicode11Addon)
    term.loadAddon(ligtureAddon)
    term.unicode.activeVersion = '11'
    term.loadAddon(this.fitAddon)
    term.loadAddon(this.searchAddon)
    term.loadAddon(this.cmdAddon)
    term.loadAddon(this.serializeAddon)
    this.osc52Addon = new Osc52Addon()
    term.loadAddon(this.osc52Addon)
    if (tab.enableTerminalImage) {
      const ImageAddon = await loadImageAddon()
      this.imageAddon = new ImageAddon({
        pixelLimit: 33554432
      })
      term.loadAddon(this.imageAddon)
    }
    term.onData(this.onData)
    this.term = term
    term.onSelectionChange(this.onSelectionChange)
    term.attachCustomKeyEventHandler(this.handleKeyboardEvent.bind(this))
    // 所有终端都从内置 DOM renderer 起步，只有真实可见的终端才由 lifecycle
    // controller 在下一动画帧惰性激活 WebGL；隐藏终端照常建立 SSH/socket，
    // 但不占用 WebGL context。这里绝不 await 激活：WebGL 的加载延迟不能阻塞
    // 后面的 restoreReloadScreen() 和 remoteInit()。
    this.rendererLifecycleReady = true
    this.setupRendererLifecycle()
    this.reconcileRenderer('initial')
      .catch(error => console.error('initial renderer reconcile failed', error))
    // 容器不可见（隐藏标签 display:none）时不 fit，避免算出 0 列把 shell
    // 提示符逐字符错误换行；待标签激活可见后由 fitAndRefresh 重新适配。
    if (this.isElementVisible()) {
      this.fitAddon.fit()
    }
    await this.restoreReloadScreen(term)
    await this.remoteInit(term)
  },

  onSelectionChange () {
    const hasSelection = this.term.hasSelection()
    const txt = hasSelection ? this.term.getSelection().trim() : ''
    this.setState({ hasSelection })
    refsStatic.get('unix-timestamp-tooltip')?.onSelection(txt)
  },

  webLinkHandler (event, url) {
    if (event?.button === 2) {
      return false
    }
    if (!this.props.config.ctrlOrMetaOpenTerminalLink) {
      return window.openLink(url, '_blank')
    }
    if (keyControlPressed(event)) {
      window.openLink(url, '_blank')
    }
  }
}
