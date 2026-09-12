/**
 * Crash / process-gone reporter
 * Logs dead child / render processes and prints actionable hints
 * (GPU flags vs missing system fonts) to stderr.
 */

const { app } = require('electron')
const log = require('../common/log')

// exit code 133 = 128 + SIGTRAP(5), which is how Chromium's SK_ABORT() dies.
// On Linux we hit it inside Skia when not a single usable font can be resolved.
const SIGTRAP_EXIT_CODE = 133

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
  DISABLE_GPU_SANDBOX=1 (Disable GPU + sandbox, use SwiftShader)
  ENABLE_GPU=1          (Linux only: force-enable hardware GPU)

Example:
  electerm --no-sandbox
  or
  DISABLE_GPU=1 electerm
================================================================================
`

// Missing font suggestion message
const FONT_ERROR_SUGGESTION = `
================================================================================
⚠️  Crash Caused By Missing Fonts (exit code ${SIGTRAP_EXIT_CODE} / SIGTRAP)
================================================================================
Chromium aborted inside Skia, which on Linux almost always means this system
has no usable font at all (minimal installs, containers, servers).
The usual GPU workarounds (--no-sandbox, --disable-gpu) do NOT help here.

Check:
  fc-list | wc -l   (should list the installed fonts)
  fc-match sans     (should resolve to a real font file)

Fix (Debian/Ubuntu):
  sudo apt-get install -y fontconfig fonts-dejavu-core
  sudo fc-cache -fv
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
  if (exitCode === SIGTRAP_EXIT_CODE) {
    console.error(FONT_ERROR_SUGGESTION)
  } else if (type === 'GPU' || GPU_EXIT_CODES.has(exitCode)) {
    console.error(GPU_ERROR_SUGGESTION)
  }
}

function setupCommandLineSwitches () {
  // Handle GPU issues on Linux
  // On Linux, disable GPU for compatibility (many systems lack proper EGL/GL
  // drivers — servers, containers, VMs, minimal desktops, etc.).
  // Set ENABLE_GPU=1 to opt out and use hardware GPU acceleration on Linux.
  if (process.env.ENABLE_GPU !== '1' && (process.platform === 'linux' || process.env.DISABLE_GPU)) {
    app.commandLine.appendSwitch('disable-gpu')
    app.commandLine.appendSwitch('disable-gpu-compositing')
    app.commandLine.appendSwitch('disable-gpu-rasterization')
    // Use SwiftShader (software GL) to bypass EGL/DRM initialisation entirely.
    // Without this, the GPU process still tries EGL and spams errors like:
    //   "Unsupported flags 0x0", "fourcc format invalid",
    //   "Couldn't allocate DRM buffer", "Invalid format", etc.
    app.commandLine.appendSwitch('use-gl', 'swiftshader')
  }
  if (process.platform === 'linux') {
    app.commandLine.appendSwitch('enable-transparent-visuals')
    app.commandLine.appendSwitch('in-process-gpu')
  }
  if (process.platform === 'linux' || process.env.DISABLE_HARDWARE_ACCELERATION) {
    app.disableHardwareAcceleration()
  }
  if (process.env.DISABLE_GPU_SANDBOX) {
    app.disableHardwareAcceleration()
    app.commandLine.appendSwitch('disable-gpu')
    app.commandLine.appendSwitch('disable-gpu-compositing')
    app.commandLine.appendSwitch('disable-gpu-rasterization')
    app.commandLine.appendSwitch('disable-gpu-sandbox')
    app.commandLine.appendSwitch('disable-software-rasterizer')
    app.commandLine.appendSwitch('use-gl', 'swiftshader')
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

function setupCrashReporter () {
  // Handle GPU / utility process crashes.
  // 'gpu-process-crashed' is gone since Electron 11 and never fires again,
  // 'child-process-gone' is the only event that still reports the GPU process.
  app.on('child-process-gone', (event, details) => {
    reportProcessGone('Child process', details)
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
  describeExitCode,
  SIGTRAP_EXIT_CODE,
  GPU_EXIT_CODES,
  GPU_ERROR_SUGGESTION,
  FONT_ERROR_SUGGESTION
}
