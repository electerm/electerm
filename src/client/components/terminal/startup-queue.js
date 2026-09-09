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
  detectShellType
} from './shell.js'
import { createRestoreCwdCommand } from './ssh-reload-state.js'
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
    return this.term.isSsh()
  }

  isLocal = () => {
    return this.term.isLocal()
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

  runInitScript = () => {
    const { term } = this
    window.store.triggerResize()
    const {
      startDirectory,
      runScripts
    } = term.props.tab

    const scripts = runScripts ? [...runScripts] : []
    const reloadCwd = term.props.config.restoreTerminalSessionOnReload && this.isSsh()
      ? term.props.tab._reloadState?.cwd
      : ''
    const startFolder = reloadCwd || startDirectory || window.initFolder
    const cwdCommand = this.isSsh()
      ? createRestoreCwdCommand(startFolder)
      : startFolder ? `cd "${startFolder}"` : ''
    if (cwdCommand) {
      scripts.unshift({ script: cwdCommand, delay: 0 })
    }

    const token = ++this.token
    this.queue = []

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

  canInjectShellIntegration = () => {
    const { config, sftpPathFollowSsh } = this.term.props
    return (
      config.showCmdSuggestions ||
      sftpPathFollowSsh ||
      (config.restoreTerminalSessionOnReload && this.isSsh())
    ) &&
    (
      this.isSsh() ||
      (this.isLocal() && !isWin)
    )
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
      const { config } = this.term.props
      const localShell = isMac ? config.execMac : config.execLinux
      shellType = detectShellType(localShell)
    } else if (this.isSsh()) {
      shellType = await Promise.race([
        this.detectRemoteShell(this.term.pid),
        new Promise(resolve => {
          setTimeout(() => resolve('sh'), remoteShellDetectTimeoutMs)
        })
      ])
    }

    this.shellType = shellType

    // Don't inject for sh type shells unless sftpPathFollowSsh is true
    if (shellType === 'sh' && !this.term.props.sftpPathFollowSsh) {
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
    const suppressionTimeout = this.isSsh() ? 5000 : 3000

    return new Promise((resolve) => {
      let done = false
      const finish = () => {
        if (done) {
          return
        }
        done = true
        this.timers.delete(safetyTimer)
        clearTimeout(safetyTimer)
        resolve()
      }
      // Hard ceiling for the whole injection. onInitialData only fires once
      // the shell produces output; when it never does (dead pty, restricted
      // shell, zmodem in progress) the promise - and the run scripts queued
      // behind it - would otherwise never be released.
      const safetyTimer = setTimeout(() => {
        if (addon.outputSuppressed) {
          // Unfreeze the screen rather than keep hiding output.
          addon.stopOutputSuppression(false)
        }
        finish()
      }, suppressionTimeout + 2000)
      this.timers.add(safetyTimer)

      // Wait for initial data (prompt/banner) to arrive before injecting
      addon.onInitialData(() => {
        if (done || this.addon !== addon || addon.disposed) {
          return finish()
        }
        // Start suppressing output before sending the integration command.
        // This hides the command and its output until OSC 633 is detected.
        addon.startOutputSuppression(suppressionTimeout, () => {
          if (!addon.disposed) {
            this.shellInjected = true
          }
          finish()
        })
        addon._sendData(integrationCmd)
      })
    })
  }
}

export default StartupQueue
