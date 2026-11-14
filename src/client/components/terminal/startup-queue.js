/**
 * Startup queue for a terminal session.
 *
 * Everything that has to be typed into a freshly connected shell goes through
 * here, strictly one item at a time:
 *
 *   shell integration injection  ->  cd/startDirectory  ->  runScripts
 *
 * Two rules keep it reliable:
 *
 * 1. Only one drain loop owns the queue at a time, and every queue generation
 *    carries a token. A reconnect (or a config toggle that rebuilds the queue)
 *    bumps the token, so a loop still waiting on the *old* connection stops
 *    instead of stealing items from the new queue - that used to silently drop
 *    the remaining run scripts.
 * 2. After each script we wait for the shell to settle (a fresh prompt, or a
 *    quiet period) before typing the next one, so nothing is ever typed into a
 *    shell that is still busy. Every wait is bounded, so a hung shell can only
 *    delay the queue, never stop it.
 */
import {
  getShellIntegrationCommand,
  detectShellType,
  shellIntegrationTypes
} from './shell.js'
import {
  createRestoreCwdCommand,
  createWindowsRestoreCwdCommand,
  isRestorableTerminalTab
} from './ssh-reload-state.js'
import { getPowerShellSpawnArgs } from '../../common/powershell-integration.js'
import { isMac, isWin } from '../../common/platform.js'

// Pacing: `settleIdleMs` of silence counts as "the shell is done",
// `settleTimeoutMs` caps the wait so a script that never returns can not
// stall the queue.
const settleIdleMs = 400
const settleTimeoutMs = 3000
// Ceiling for the best-effort remote shell probe. detectRemoteShell opens an
// extra exec channel and runCmd has no timeout of its own, so a server that
// never answers would otherwise block the whole queue forever.
const remoteShellDetectTimeoutMs = 3000
// Shell integration injection window. `injectionQuietMs` of silence from the
// shell without an OSC 633 confirmation means the prompt will not report its
// cwd, and `injectionMaxWaitMs` is the ceiling for a shell that never answers
// at all; both are measured from the shell's own output, never from the clock
// at send time (see injectShellIntegration).
const injectionQuietMs = 1500
const injectionMaxWaitMs = 10000
// How long a shell is given to draw its first prompt before injection is
// skipped. Typing earlier is what put the script on screen (#4737): the
// console holds the keystrokes until the line editor starts, which can be
// seconds later and long after the suppression window has closed.
const promptReadyQuietMs = 400
const promptReadyTimeoutMs = 8000

export class StartupQueue {
  /**
   * @param {object} term - the terminal component (host)
   * @param {object} [deps] - `detectRemoteShell` needs the network, so it is
   *   injected: it keeps this module free of the app runtime and makes the
   *   queue testable on its own.
   */
  constructor (term, deps = {}) {
    this.term = term
    this.detectRemoteShell = deps.detectRemoteShell || (() => Promise.resolve('sh'))
    this.queue = []
    this.token = 0
    this.running = false
    this.shellInjected = false
    this.shellType = null
    this.timers = new Set()
    // Timings of the "is the shell listening yet?" wait (see
    // waitForFirstPrompt). Instance fields so a test can shorten them.
    this.promptReadyQuietMs = promptReadyQuietMs
    this.promptReadyTimeoutMs = promptReadyTimeoutMs
  }

  dispose = () => {
    for (const t of this.timers) {
      clearTimeout(t)
    }
    this.timers.clear()
    this.queue = []
    this.running = false
  }

  // ---- host accessors ----

  get addon () {
    return this.term.attachAddon
  }

  get cmdAddon () {
    return this.term.cmdAddon
  }

  isClosed = () => {
    return !!this.term.onClose
  }

  isSsh = () => {
    return this.term.isSsh ? this.term.isSsh() : this.getTabType() === 'ssh'
  }

  isLocal = () => {
    return this.term.isLocal ? this.term.isLocal() : this.getTabType() === 'local'
  }

  getTabType = () => {
    return this.term.props?.tab?.type
  }

  isTelnet = () => {
    if (this.term.isTelnet) {
      return this.term.isTelnet()
    }
    return this.getTabType() === 'telnet'
  }

  isSerial = () => {
    if (this.term.isSerial) {
      return this.term.isSerial()
    }
    return this.getTabType() === 'serial'
  }

  isRemoteShell = () => {
    return this.isSsh() || this.isTelnet() || this.isSerial()
  }

  isRestorable = () => {
    const tab = this.term.props?.tab || {}
    if (typeof this.term.isShellTerminal === 'function') {
      return this.term.isShellTerminal()
    }
    return isRestorableTerminalTab(tab)
  }

  /**
   * Resolve once the shell has drawn a prompt of its own: something we had not
   * seen before arrived, and the shell has been quiet for `quietMs` since.
   *
   * Both halves matter. Silence alone is not "ready" - a shell that is still
   * booting (profile loading, conpty starting OpenConsole) is silent too, and
   * typing into it does not echo immediately: the console buffers the
   * keystrokes and the line editor draws them whenever it finally starts, which
   * can be seconds later, long after the suppression window closed. That is how
   * the injected script still ended up on screen (#4737). Output alone is not
   * ready either - the first bytes a pty sends are conpty's own init sequences,
   * printed before any prompt exists.
   *
   * Returns false when the terminal went away or the shell never settled, in
   * which case the caller must not type anything at all.
   */
  waitForFirstPrompt = (addon, { quietMs = this.promptReadyQuietMs, timeoutMs = this.promptReadyTimeoutMs } = {}) => {
    if (this.isClosed() || !addon || addon.disposed) {
      return Promise.resolve(false)
    }
    return new Promise((resolve) => {
      const startedAt = Date.now()
      let last = addon.getLastOutputTime ? addon.getLastOutputTime() : startedAt
      let sawNew = false
      let done = false
      const finish = (result) => {
        if (done) {
          return
        }
        done = true
        clearInterval(pollTimer)
        resolve(result)
      }
      const pollTimer = setInterval(() => {
        if (this.isClosed() || this.addon !== addon || addon.disposed) {
          return finish(false)
        }
        const now = Date.now()
        const seen = addon.getLastOutputTime ? addon.getLastOutputTime() : now
        if (seen > last) {
          last = seen
          sawNew = true
        }
        if (sawNew && now - last >= quietMs) {
          return finish(true)
        }
        if (now - startedAt >= timeoutMs) {
          finish(false)
        }
      }, 100)
    })
  }

  /**
   * The executable and arguments this local tab was spawned with.
   *
   * Mirrors the `execOpts` branch in term-socket.js: a bookmark-level value
   * wins over the global setting, and the arguments come from the same level as
   * the executable. The server receives exactly these, so asking the same
   * question here gives the same answer it did.
   *
   * @returns {{shell: string, args: string[]}}
   */
  getLocalExec = () => {
    const { config, tab = {} } = this.term.props
    const prop = isWin ? 'execWindows' : isMac ? 'execMac' : 'execLinux'
    const args = (tab[prop] ? tab[`${prop}Args`] : config[`${prop}Args`]) || []
    return {
      // `localShell` is what the session actually spawned, when the host knows
      shell: this.term.localShell || tab[prop] || config[prop] || '',
      args
    }
  }

  /**
   * The shell a *local* tab actually spawned: the bookmark's (profile-applied)
   * executable first, then the global setting.
   */
  getLocalShellType = () => detectShellType(this.getLocalExec().shell)

  /**
   * Did the pty already load the shell integration as a spawn argument?
   * See common/powershell-integration.js.
   */
  isSpawnInjectedShell = (shellType) => {
    if (!this.isLocal() || shellType !== 'powershell') {
      return false
    }
    const { shell, args } = this.getLocalExec()
    return getPowerShellSpawnArgs(shell, args) !== null
  }

  isPosixShell = () => {
    return this.isRemoteShell() || (this.isLocal() && !isWin)
  }

  sleep = (ms) => {
    if (ms <= 0) {
      return Promise.resolve()
    }
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        this.timers.delete(timer)
        resolve()
      }, ms)
      this.timers.add(timer)
    })
  }

  // ---- queue ----

  runInitScript = (localShell) => {
    const { term } = this
    window.store.triggerResize()
    const {
      startDirectory,
      startDirectoryLocal,
      runScripts
    } = term.props.tab

    const scripts = runScripts ? [...runScripts] : []
    const reloadCwd = term.props.config.restoreTerminalSessionOnReload && this.isRestorable()
      ? term.props.tab._reloadState?.cwd
      : ''
    // A local tab answers to the *local* start directory and nothing else: the
    // bookmark value, then the global setting, then the CLI `--init-folder`
    // that created the default tab. `startDirectory` is the far side's
    // directory (ssh/telnet/serial) and is meaningless on this machine - typing
    // it into a local shell would only move the user somewhere that does not
    // exist.
    const startFolder = reloadCwd ||
      (this.isLocal()
        ? startDirectoryLocal ||
          term.props.config.startDirectoryLocal ||
          window.initFolder
        : startDirectory)
    // Remember where the shell started: it is the base for resolving a relative
    // path the user ctrl+clicks, for the whole time shell integration has not
    // reported a live cwd yet (and forever, on shells that cannot report one).
    term.setInitialCwd?.(startFolder || '')
    let cwdCommand = ''
    if (startFolder) {
      // No `|| cd "<raw>"` fallback: these helpers return '' for a path they
      // refuse (control characters, over-long), and interpolating the raw value
      // instead would hand `startDirectory` - which a quick-connect link can
      // set - straight to the shell as a command.
      cwdCommand = this.isPosixShell()
        ? createRestoreCwdCommand(startFolder)
        : createWindowsRestoreCwdCommand(startFolder, localShell || term.props.config.execWindows)
    }
    if (cwdCommand) {
      scripts.unshift({ script: cwdCommand, delay: 0 })
    }

    const token = ++this.token
    this.queue = []
    // A new connection is a new pty: whatever was injected into the previous
    // one did not survive it, so the "already injected" answer has to be
    // forgotten - otherwise a reconnect would type the start directory into a
    // shell that is still booting, without waiting for its prompt.
    this.shellInjected = false
    this.shellType = null

    if (this.canInjectShellIntegration()) {
      this.queue.push({
        type: 'shell_integration',
        execute: async () => {
          await this.injectShellIntegration()
        }
      })
    }

    scripts.forEach((script, i) => {
      this.queue.push({
        type: 'delayed_script',
        script: script.script,
        delay: script.delay || 0,
        // Nothing follows the last one, so waiting for the shell to settle
        // would only add latency.
        isLast: i === scripts.length - 1,
        execute: () => {
          if (script.script && this.addon) {
            this.addon._sendData(script.script + '\r')
          }
        }
      })
    })

    this.start(token)
  }

  /**
   * Put a shell integration injection at the head of the queue.
   * Inserting - instead of firing it off immediately - keeps it serialized
   * against anything still queued and guarantees a single drain loop.
   */
  enqueueShellIntegration = (sendEnter) => {
    this.queue.unshift({
      type: 'shell_integration',
      execute: async () => {
        await this.injectShellIntegration()
        // A fresh prompt makes the shell emit OSC 633 ;P Cwd= right away, so
        // the file manager picks the current path up without waiting for the
        // user's next command.
        if (sendEnter && this.addon) {
          this.addon._sendData('\r')
        }
      }
    })
    this.start(this.token)
  }

  /**
   * Drain the queue one item at a time. Re-entrant calls only push items and
   * return, so two loops can never interleave or race for the same array.
   */
  start = async (token) => {
    if (this.running) {
      return
    }
    this.running = true
    try {
      while (
        !this.isClosed() &&
        token === this.token &&
        this.queue.length > 0
      ) {
        const item = this.queue.shift()
        try {
          await this.runItem(item)
        } catch (error) {
          console.error('[Shell Integration] Error processing queue item:', item.type, error)
        }
      }
    } finally {
      this.running = false
      // A newer queue was built while this loop was still draining (reconnect,
      // config toggle). Pick it up here, otherwise the fresh items would sit
      // in the array with nobody left to run them.
      if (
        !this.isClosed() &&
        token !== this.token &&
        this.queue.length > 0
      ) {
        this.start(this.token)
      }
    }
  }

  runItem = async (item) => {
    if (this.isClosed() || !this.addon) {
      return
    }
    if (item.type === 'shell_integration') {
      await item.execute()
      // Give the freshly injected prompt a moment to finish drawing before
      // anything is typed into it.
      await this.waitForSettle({ usePrompt: false })
      return
    }
    if (item.type !== 'delayed_script') {
      return
    }
    item.execute()
    if (item.isLast) {
      return
    }
    await this.sleep(item.delay)
    // Never type the next script into a shell that is still busy. Bounded, so
    // a script that never returns can not block the rest of the queue.
    await this.waitForSettle()
  }

  /**
   * Wait until the terminal stops producing output before typing the next
   * queued item. Resolves on whichever comes first:
   *  - a fresh prompt (OSC 633 ;A), when shell integration is active - the
   *    exact "previous command finished" signal
   *  - no output for `idleMs`
   * Always resolves; `timeoutMs` caps it.
   */
  waitForSettle = ({ timeoutMs = settleTimeoutMs, idleMs = settleIdleMs, usePrompt = true } = {}) => {
    const addon = this.addon
    if (this.isClosed() || !addon || !addon.waitForOutputIdle || addon.disposed) {
      return Promise.resolve(false)
    }
    const idle = addon.waitForOutputIdle({ idleMs, timeoutMs })
    if (!usePrompt || !this.cmdAddon || !this.cmdAddon.onPrompt) {
      return idle
    }
    return new Promise((resolve) => {
      let done = false
      let unsubscribe = null
      const finish = (result) => {
        if (done) {
          return
        }
        done = true
        clearTimeout(capTimer)
        if (unsubscribe) {
          unsubscribe()
        }
        resolve(result)
      }
      unsubscribe = this.cmdAddon.onPrompt(() => finish('prompt'))
      const capTimer = setTimeout(() => finish(false), timeoutMs + 200)
      this.timers.add(capTimer)
      idle.then(quiet => finish(quiet ? 'idle' : false))
    })
  }

  // ---- shell integration ----

  /**
   * Shell integration is a Bourne-shell script typed into the session, so it
   * may only go where a POSIX shell is known to be listening: locally, where
   * we spawned that shell ourselves, or over ssh, where `$SHELL` can be read
   * on an exec channel.
   *
   * Telnet and serial are raw byte pipes to whatever sits on the other end -
   * a Huawei VRP switch, a console server, a UART. Nothing can be probed
   * there, so the old `sh` fallback typed the script into CLIs that cannot
   * run it: the device echoes it, the suppression window freezes the screen
   * until it times out, and the text is then replayed into the scrollback.
   * See issue #4610.
   */
  canInjectShellIntegration = () => {
    const { config, sftpPathFollowSsh } = this.term.props
    const wanted =
      config.showCmdSuggestions ||
      sftpPathFollowSsh ||
      (config.restoreTerminalSessionOnReload && this.isRestorable())
    if (this.isSsh()) {
      return !!wanted
    }
    if (!this.isLocal()) {
      return false
    }
    if (isWin) {
      // Windows: only PowerShell can report its cwd from the prompt, and it is
      // worth doing unconditionally - a ctrl+clicked relative path is resolved
      // against that cwd, so the optional features above must not gate it.
      // `cmd` has no equivalent, so it stays a plain terminal (#4737).
      return this.getLocalShellType() === 'powershell'
    }
    return !!wanted
  }

  /**
   * Inject shell integration commands from client-side.
   * Replaces the server-side `source xxx.xxx` approach; output suppression
   * hides the injection command. Resolves when injection is complete - or
   * when it is given up on, never hangs.
   */
  injectShellIntegration = async () => {
    if (this.shellInjected) {
      return
    }

    const addon = this.addon
    if (!addon) {
      return
    }

    let shellType
    if (this.isLocal()) {
      shellType = this.getLocalShellType()
    } else if (this.isRemoteShell()) {
      shellType = await Promise.race([
        this.detectRemoteShell(this.term.pid),
        new Promise(resolve => {
          setTimeout(() => resolve(''), remoteShellDetectTimeoutMs)
        })
      ])
    }

    // '' means the far side never said what shell it runs: the probe channel
    // was refused, answered with a CLI error banner, or timed out. Guessing
    // `sh` in that case is exactly what typed the script into a switch - skip
    // instead, and let the session stay a plain terminal.
    if (!shellType) {
      return
    }

    // `cmd` is detected only to keep it out: it cannot run any script we have.
    if (!shellIntegrationTypes.has(shellType)) {
      return
    }

    this.shellType = shellType

    // A local PowerShell may already have the integration loaded: the server
    // hands it to the pty as `-NoExit -Command <script>` at spawn time
    // (server/session-local.js), so there is nothing to type here - and typing
    // it is exactly what used to leave the script on screen. The wait still
    // matters: the `cd` and run scripts queued behind this item must not be
    // typed into a shell that is still booting. Both sides ask the same helper,
    // so "the server injected" and "do not type" can not disagree.
    if (this.isSpawnInjectedShell(shellType)) {
      this.shellInjected = true
      await this.waitForFirstPrompt(this.addon)
      return
    }

    // sh/ash only reports cwd via PS1 (no command tracking), so it is only
    // worth injecting when something actually needs the cwd: sftp follow or
    // session restore. Command suggestions alone stay disabled on sh.
    const { config, sftpPathFollowSsh } = this.term.props
    if (
      shellType === 'sh' &&
      !sftpPathFollowSsh &&
      !config.restoreTerminalSessionOnReload
    ) {
      return
    }

    // The connection (or the whole terminal) can go away while
    // detectRemoteShell is in flight. Bail instead of registering callbacks
    // on a dead socket - that is what used to leave the queue, and every run
    // script behind it, waiting forever.
    if (this.isClosed() || this.addon !== addon || addon.disposed) {
      return
    }

    const integrationCmd = getShellIntegrationCommand(shellType)

    return new Promise((resolve) => {
      let done = false
      let gaveUp = false
      let pollTimer = null
      const finish = () => {
        if (done) {
          return
        }
        done = true
        clearInterval(pollTimer)
        pollTimer = null
        resolve()
      }
      // Stop hiding output *without* showing what was hidden: everything
      // buffered in this window is the echo of the injection itself, which is
      // exactly what the window exists to keep off the screen. Writing it out
      // is what made the injected script appear in a PowerShell tab (#4737).
      //
      // Nothing reached the terminal, so the screen is left at whatever it
      // showed before the injection - which, on a shell that drew its first
      // prompt inside the window, is nothing at all. One empty Enter asks the
      // shell for a fresh prompt; it is skipped when the line may hold
      // unsubmitted input (a password prompt, hidden input, a full-screen
      // program), where a stray Enter is worse than a bare line.
      const giveUp = () => {
        if (done) {
          return
        }
        gaveUp = true
        if (addon.outputSuppressed) {
          addon.stopOutputSuppression(true)
          if (
            this.addon === addon &&
            !addon.disposed &&
            typeof addon._lineHasUnsubmittedInput === 'function' &&
            !addon._lineHasUnsubmittedInput()
          ) {
            addon._sendData('\r')
          }
        }
        finish()
      }

      // Wait for initial data (prompt/banner) to arrive before injecting
      addon.onInitialData(() => {
        if (done || this.addon !== addon || addon.disposed) {
          return finish()
        }
        // And then wait for the prompt those bytes were not: see
        // waitForFirstPrompt. Nothing is typed until the shell is actually
        // listening, so no keystroke can sit in the console buffer and be
        // drawn after the suppression window is gone. A remote login banner
        // trickles over the network, so its "quiet" has to be longer - typing
        // into a half-drawn login prompt is how a password ends up in a log.
        this.waitForFirstPrompt(addon, {
          quietMs: this.isRemoteShell() ? 1500 : this.promptReadyQuietMs
        }).then((ready) => {
          if (done || this.addon !== addon || addon.disposed) {
            return finish()
          }
          if (!ready) {
            // Booting shell, or one that never settles. Skip the injection:
            // a plain terminal is a far better outcome than a screen full of
            // script.
            return finish()
          }
          const startedAt = Date.now()
          // A remote shell answers across the network, so its silence is worth
          // more than a local one's: one slow round trip must not read as "the
          // prompt will never confirm".
          const quietMs = this.isRemoteShell() ? 2500 : injectionQuietMs
          let sawOutput = false
          let lastSeen = startedAt

          // The deadline is measured from the last chunk the shell sent, not
          // from the moment we typed: a shell that has not answered yet has not
          // read the command, so hiding a little longer costs nothing, while an
          // elapsed-time deadline expires *before* the shell even echoes -
          // PowerShell can take seconds to draw its very first prompt (conpty +
          // profile load), which is precisely how the injection ended up on
          // screen. Once the shell does answer, `quietMs` of silence without an
          // OSC 633 confirmation means the prompt will never report the cwd
          // (wrapped too early, or the user's profile replaced `prompt`
          // afterwards), so give up instead of hiding output indefinitely.
          pollTimer = setInterval(() => {
            if (done) {
              return
            }
            if (this.addon !== addon || addon.disposed) {
              return giveUp()
            }
            const now = Date.now()
            const last = addon.getLastOutputTime()
            if (last > lastSeen) {
              lastSeen = last
              sawOutput = true
            }
            // The addon ended the window itself - OSC 633 was seen.
            if (!addon.outputSuppressed) {
              return
            }
            if (!sawOutput) {
              if (now - startedAt >= injectionMaxWaitMs) {
                giveUp()
              }
              return
            }
            if (now - lastSeen >= quietMs) {
              giveUp()
            }
          }, 200)

          // Start suppressing output before sending the integration command.
          // This hides the command and its output until OSC 633 is detected.
          // The addon's own timer is only a backstop: the poll above decides.
          addon.startOutputSuppression(injectionMaxWaitMs + 2000, () => {
            if (!gaveUp && !addon.disposed) {
              this.shellInjected = true
            }
            finish()
          }, true)
          addon._sendData(integrationCmd)
        })
      })
    })
  }
}

export default StartupQueue
