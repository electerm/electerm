/**
 * Crash / process-gone reporter
 * Logs dead child / render processes and prints actionable hints (GPU flags)
 * to stderr.
 */

const { app } = require('electron')
const fs = require('fs')
const path = require('path')
const log = require('../common/log')

// Chromium's Windows GPU crash status codes (0x80000003 STATUS_BREAKPOINT),
// as Electron reports them to us (signed).
const GPU_EXIT_CODES = new Set([-2147483645])

// POSIX exit code 128 + signo, so the log says something readable
const SIGNALS = {
  4: 'SIGILL',
  5: 'SIGTRAP',
  6: 'SIGABRT',
  7: 'SIGBUS',
  8: 'SIGFPE',
  9: 'SIGKILL',
  11: 'SIGSEGV',
  15: 'SIGTERM'
}

const describeExitCode = exitCode => {
  if (typeof exitCode !== 'number') {
    return 'unknown'
  }
  if (exitCode > 128 && exitCode <= 192) {
    const signo = exitCode - 128
    return `${exitCode} / signal ${signo}${SIGNALS[signo] ? ` (${SIGNALS[signo]})` : ''}`
  }
  return String(exitCode)
}

// GPU error suggestion message
const GPU_ERROR_SUGGESTION = `
================================================================================
⚠️  GPU Process Error Detected
================================================================================
If you encounter GPU process crashes (exit_code=-2147483645 or similar),
try running electerm with one of these flags:

  1. --no-sandbox          (Recommended - run without sandbox)
  2. --disable-gpu        (Disable GPU rendering)
  3. --disable-gpu-sandbox (Disable GPU sandbox)
  4. --disable-hardware-acceleration

Or set environment variable:
  DISABLE_GPU=1         (Disable GPU)
  DISABLE_GPU_SANDBOX=1 (Disable GPU + sandbox)
  ENABLE_GPU=1          (Force hardware GPU, also cancels the automatic
                         software fallback below)

electerm switches to software rendering by itself on the next launch after a
GPU process crash, so a manual flag is usually not needed.
================================================================================
`

// A dead process is not necessarily a GPU crash: a renderer can die for
// dozens of reasons that have nothing to do with the GPU, so only print the
// advice that actually matches what died and how.
const reportProcessGone = (label, details = {}) => {
  const {
    type,
    reason,
    exitCode,
    serviceName,
    name
  } = details
  log.error(
    `${label} gone: type=${type || '-'} reason=${reason || '-'} ` +
    `exitCode=${describeExitCode(exitCode)}` +
    `${serviceName ? ` service=${serviceName}` : ''}` +
    `${name ? ` name=${name}` : ''}`,
    details
  )
  if (type === 'GPU' || GPU_EXIT_CODES.has(exitCode)) {
    console.error(GPU_ERROR_SUGGESTION)
  }
}

// --- software-rendering fallback -------------------------------------------
//
// We do not guess the graphics stack at startup any more. Chromium picks its
// own backend, and if that backend is broken (no EGL/GL, bad Mesa/ROCm install,
// VM/container, WSL, old GPU, driver crash) the GPU process dies. Instead of
// pre-emptively crippling rendering for every Linux user, we note the failure
// and start with software rendering on the NEXT launch.
//
// This is the only mechanism that is both general and honest: it reacts to a
// real crash on any platform (Linux X11/Wayland, Windows, macOS) instead of
// matching on platform/env heuristics, and it costs the happy path nothing.
//
// `in-process-gpu` used to be set here for the same reason and is gone: it is
// a Chromium test switch (GPU runs inside the browser process) that Electron
// does not support, it defeats the point of having a separate GPU process at
// all, and it deadlocks shutdown on Wayland (main thread joins wayland-fd,
// which waits on a task queued to the blocked main thread) -- see issue #4654.
const gpuFallbackFlagPath = () => path.join(
  app.getPath('userData'),
  'gpu-software-fallback.json'
)

const startupMarkerPath = () => path.join(
  app.getPath('userData'),
  'gpu-startup.json'
)

// Two early deaths in a row before any window finished loading. One is a user
// killing the splash or an unrelated crash; two in a row is a graphics stack
// that never came up.
const STARTUP_FAILURE_LIMIT = 2

// The fallback expires: a driver update or a fixed Mesa must be able to bring
// hardware acceleration back without the user deleting a file. Same 24h window
// other Electron apps use for this.
const RECOVER_WINDOW_MS = 24 * 60 * 60 * 1000

const readJson = file => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

const writeJson = (file, data) => {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(data, null, 2))
  } catch (e) {
    log.error(`write ${file} failed`, e)
  }
}

const clearGpuFallback = () => {
  try {
    fs.unlinkSync(gpuFallbackFlagPath())
  } catch {}
}

// null / expired means "try the hardware path again this launch"
const readGpuFallback = () => {
  const info = readJson(gpuFallbackFlagPath())
  if (!info) {
    return null
  }
  if (Date.now() - (info.lastGpuCrash || 0) > RECOVER_WINDOW_MS) {
    clearGpuFallback()
    return null
  }
  return info
}

const saveGpuFallback = (details, count) => {
  writeJson(gpuFallbackFlagPath(), {
    lastGpuCrash: Date.now(),
    lastGpuCrashReason: details.reason || details.type || 'unknown',
    gpuCrashCount: count,
    appVersion: app.getVersion()
  })
}

const startupFailureCount = () => {
  const marker = readJson(startupMarkerPath())
  return marker && marker.count > 0 ? marker.count : 0
}

const clearStartupMarker = () => {
  try {
    fs.unlinkSync(startupMarkerPath())
  } catch {}
}

// ENABLE_GPU=1 is an explicit "I want the hardware path": honour it and forget
// an auto-fallback, so a user can retry hardware acceleration right away after
// a driver update instead of waiting out the 24h window.
const useSoftwareRendering = () => {
  if (process.env.ENABLE_GPU === '1') {
    clearGpuFallback()
    clearStartupMarker()
    return false
  }
  if (
    process.env.DISABLE_GPU ||
    process.env.DISABLE_GPU_SANDBOX ||
    process.env.DISABLE_HARDWARE_ACCELERATION
  ) {
    return true
  }
  return !!readGpuFallback()
}

// Software mode: the official API plus the two switches it stands for, so the
// behaviour is the same on every platform and old Electron versions. What is
// deliberately NOT here any more: `use-gl=swiftshader` (pins one backend
// instead of letting Chromium pick a working one) and `in-process-gpu`.
const enableSoftwareRendering = () => {
  app.disableHardwareAcceleration()
  app.commandLine.appendSwitch('disable-gpu')
  app.commandLine.appendSwitch('disable-gpu-compositing')
}

// Decide the rendering mode for THIS launch. Three inputs, in order: explicit
// env, a remembered GPU failure (24h), and the startup counter (the only thing
// that can catch a launch which died before we could run any JS at all --
// Chromium's "GPU process isn't usable. Goodbye." abort).
function setupCommandLineSwitches () {
  const earlierFailures = startupFailureCount()
  if (useSoftwareRendering()) {
    enableSoftwareRendering()
    // No need to count: we are already in software mode.
    clearStartupMarker()
  } else if (earlierFailures >= STARTUP_FAILURE_LIMIT) {
    log.warn(
      `app failed to reach a window on ${earlierFailures} launches in a row, ` +
      'switching to software rendering for 24h (set ENABLE_GPU=1 to skip that)'
    )
    saveGpuFallback({ reason: 'startup-abort' }, earlierFailures)
    clearStartupMarker()
    enableSoftwareRendering()
  } else {
    writeJson(startupMarkerPath(), {
      count: earlierFailures + 1,
      at: new Date().toISOString(),
      appVersion: app.getVersion()
    })
  }
  if (process.env.DISABLE_GPU_SANDBOX) {
    app.commandLine.appendSwitch('disable-gpu-sandbox')
  }
  if (process.platform === 'linux') {
    // Transparent windows (background opacity) need this on Linux. Unrelated
    // to rendering, keep it on every Linux session.
    app.commandLine.appendSwitch('enable-transparent-visuals')
  }
  // Windows only. "Hide pointer while typing" (Settings > Bluetooth & devices >
  // Mouse, on by default) maps to Chromium's HideCursorWhileTyping feature.
  // Typing in the terminal calls ::ShowCursor(FALSE), and since ShowCursor is
  // counted per thread (the browser UI thread) the pointer then stays hidden
  // over EVERY window of the app. Normally a mouse move over the same window
  // shows it again, but a native modal dialog disables its parent, so the
  // parent never gets that event and the pointer stays invisible for as long as
  // the dialog is open -- including over the dialog itself, where the user just
  // sees an unclickable app (clicks still land correctly). Reproduced by
  // "save terminal log to file" / "record" right after typing, but any dialog
  // opened straight after a keystroke hits it.
  // Upstream: https://github.com/electron/electron/issues/54630
  // Drop this once that issue is fixed and we can move past that Electron.
  if (process.platform === 'win32') {
    app.commandLine.appendSwitch('disable-features', 'HideCursorWhileTyping')
  }
  // Handle proxy-related command-line arguments
  if (process.env.NO_PROXY_SERVER) {
    app.commandLine.appendSwitch('no-proxy-server')
  }
  if (process.env.PROXY_BYPASS_LIST) {
    app.commandLine.appendSwitch('proxy-bypass-list', process.env.PROXY_BYPASS_LIST)
  }
  if (process.env.PROXY_PAC_URL) {
    app.commandLine.appendSwitch('proxy-pac-url', process.env.PROXY_PAC_URL)
  }
  if (process.env.PROXY_SERVER) {
    app.commandLine.appendSwitch('proxy-server', process.env.PROXY_SERVER)
  }
}

// A GPU process that dies is the one signal that actually tells us the
// environment cannot do hardware rendering. Record it so the next launch comes
// up in software mode; the 24h window means a fixed driver gets another try
// without the user doing anything.
let gpuCrashCount = 0
const noteGpuFailure = details => {
  if (
    details.type !== 'GPU' ||
    details.reason === 'clean-exit' ||
    process.env.ENABLE_GPU === '1' ||
    useSoftwareRendering()
  ) {
    return
  }
  gpuCrashCount++
  log.warn(
    'GPU process failed, next launch will use software rendering for 24h ' +
    '(set ENABLE_GPU=1 to skip that)'
  )
  saveGpuFallback(details, gpuCrashCount)
}

function setupCrashReporter () {
  // Handle GPU / utility process crashes.
  // 'gpu-process-crashed' is gone since Electron 11 and never fires again,
  // 'child-process-gone' is the only event that still reports the GPU process.
  app.on('child-process-gone', (event, details) => {
    reportProcessGone('Child process', details)
    noteGpuFailure(details)
  })

  // Any orderly exit -- including a second instance that never gets a window
  // because the first one holds the lock -- must not look like an early death.
  // Only a process that dies without running exit hooks (Chromium's GPU abort,
  // SIGKILL) leaves the marker behind.
  process.on('exit', clearStartupMarker)

  // Reaching a loaded page means the graphics stack came up this time. Forget
  // the startup counter so an isolated kill (or an unrelated crash early in
  // boot) never permanently degrades rendering.
  app.on('browser-window-created', (event, win) => {
    const loaded = () => clearStartupMarker()
    win.webContents.once('did-finish-load', loaded)
    win.webContents.once('dom-ready', loaded)
  })

  // Handle render process gone events
  app.on('render-process-gone', (event, webContents, details) => {
    if (details.reason === 'clean-exit') {
      return
    }
    reportProcessGone('Render process', details)
  })

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    const errorMsg = error?.message || ''
    // Check if it's GPU related
    if (
      errorMsg.includes('GPU') ||
      errorMsg.includes('gpu') ||
      errorMsg.includes('graphics') ||
      errorMsg.includes('Vulkan') ||
      errorMsg.includes('DXGI')
    ) {
      console.error(GPU_ERROR_SUGGESTION)
    }
  })
}

module.exports = {
  setupCrashReporter,
  setupCommandLineSwitches,
  reportProcessGone,
  useSoftwareRendering,
  gpuFallbackFlagPath,
  clearGpuFallback,
  clearStartupMarker,
  describeExitCode,
  GPU_EXIT_CODES,
  GPU_ERROR_SUGGESTION
}
