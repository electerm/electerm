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
    const tc = this.getRendererThemeConfig(themeConfig)
    const Terminal = await loadTerminal()
    const term = new Terminal({
      allowProposedApi: true,
      scrollback: config.scrollback,
      rightClickSelectsWord: config.rightClickSelectsWord || false,
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
    await this.loadRenderer(term, config)
    this.fixSelectionColors(term)
    // Re-apply the theme after the renderer is loaded. The Terminal was
    // constructed before UiTheme's useEffect ran, so the initial theme
    // may have a stale background. Pass `term` directly because this.term
    // is not assigned yet. Use deferred=true so a second repaint picks up
    // any CSS --main changes applied by UiTheme's useEffect.
    if (config.rendererType === rendererTypes.webGL) {
      this.applyTerminalTheme(true, term)
    }

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
