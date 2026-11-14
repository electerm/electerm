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
import { isWin } from '../../../common/platform.js'
import { fileUrlToPath } from '../local-path-links.js'
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
    // Always start with the built-in DOM renderer's theme: the terminal begins
    // on DOM, and the lifecycle controller activates WebGL lazily once it is
    // really visible and re-applies the theme there.
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
    // The theme is intentionally not re-applied here based on
    // config.rendererType: every terminal starts on the DOM renderer, and the
    // WebGL theme is only applied by activateVisibleWebglRenderer once the
    // lifecycle controller really activates WebGL. Applying it during init
    // would contradict the DOM theme set just above.

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
    this.initOsc8LinkHandler(term)
    // Every terminal starts on the built-in DOM renderer; only a really
    // visible one gets WebGL, activated lazily by the lifecycle controller on
    // the next animation frame. A hidden terminal still connects its
    // SSH/socket as usual, it just does not hold a WebGL context. Activation is
    // never awaited here: WebGL load latency must not block the
    // restoreReloadScreen() and remoteInit() calls below.
    this.rendererLifecycleReady = true
    this.setupRendererLifecycle()
    this.reconcileRenderer('initial')
      .catch(error => console.error('initial renderer reconcile failed', error))
    // Do not fit while the container is invisible (hidden tab, display:none):
    // 0 columns would wrap the shell prompt character by character. The fit is
    // redone by fitAndRefresh() once the tab is visible.
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

  /**
   * OSC 8 hyperlinks. xterm drops every non-http URI before it is activated
   * unless a handler opts in, so `file://` links printed by a tool did nothing.
   * `allowNonHttpProtocols` only becomes safe because the handler below
   * forwards `file:` to the file manager and http(s) to the browser, and
   * ignores every other scheme - `shell.openExternal` would happily hand
   * `smb:`/`search-ms:`/... to the OS (#4737).
   */
  initOsc8LinkHandler (term) {
    if (!term || !term.options) {
      return
    }
    term.options.linkHandler = {
      allowNonHttpProtocols: true,
      activate: (event, url) => this.activateOsc8Link(event, url)
    }
  },

  /**
   * One click gate for everything clickable in the terminal: web links, OSC 8
   * hyperlinks and local file paths all follow `ctrlOrMetaOpenTerminalLink`.
   * With it on, only ctrl/cmd+click activates; with it off, a plain click does.
   * A right click is never an activation, so the context menu keeps working on
   * top of a link.
   */
  shouldActivateTerminalLink (event) {
    if (event?.button === 2) {
      return false
    }
    return !this.props.config.ctrlOrMetaOpenTerminalLink ||
      !!keyControlPressed(event)
  },

  activateOsc8Link (event, url) {
    const text = String(url || '')
    if (/^https?:\/\//i.test(text)) {
      if (this.shouldActivateTerminalLink(event)) {
        window.openLink(text, '_blank')
      }
      return
    }
    if (!this.canLinkLocalPaths() || !this.shouldActivateTerminalLink(event)) {
      return
    }
    const path = fileUrlToPath(text, { isWin })
    if (path) {
      window.pre.showItemInFolder(path)
    }
  },

  webLinkHandler (event, url) {
    if (event?.button === 2) {
      return false
    }
    if (this.shouldActivateTerminalLink(event)) {
      window.openLink(url, '_blank')
    }
  },

  /**
   * Ctrl+click on a local file path reveals it in the file manager (#4737).
   * The ctrl/cmd requirement follows `ctrlOrMetaOpenTerminalLink`, exactly like
   * a printed web link, so the user has one rule to remember.
   *
   * Local tabs only: a path printed by an ssh/telnet/serial session belongs to
   * the far machine, and the web build has no file manager to reveal it in.
   * Registered per connection, so a reconnect replaces the previous provider
   * instead of stacking a second one that would open the same folder twice.
   */
  async initLocalPathLinks (term) {
    this.localPathLinkDisposable?.dispose()
    this.localPathLinkDisposable = null
    if (!this.canLinkLocalPaths()) {
      return
    }
    try {
      const { LocalPathLinkProvider } = await import('../local-path-link-provider.js')
      this.localPathLinkDisposable = term.registerLinkProvider(
        new LocalPathLinkProvider({
          term,
          isWin,
          getCwd: () => this.getLinkCwd(),
          openPath: path => window.pre.showItemInFolder(path),
          shouldActivate: event => this.shouldActivateTerminalLink(event)
        })
      )
    } catch (err) {
      // a failed chunk fetch must not take the session down with it: the
      // terminal simply stays without local path links
      console.error('local path links unavailable', err)
    }
  },

  canLinkLocalPaths () {
    // the web app runs on another machine: a "local" path there is not on the
    // user's disk and it has no file manager to reveal it in
    return !window.et?.isWebApp &&
      this.isLocal() &&
      !!(window.pre && window.pre.showItemInFolder)
  }
}
