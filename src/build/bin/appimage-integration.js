/**
 * Install .desktop file and icon for AppImage on Linux
 * so that taskbars (e.g. UOS/Deepin dde-dock) can find the icon.
 *
 * This is standard practice for AppImage — the format uses a volatile
 * FUSE mount path, so the embedded .desktop file and icon are never
 * found by desktop environments that look in XDG standard locations.
 */

const fs = require('fs')
const path = require('path')
const os = require('os')
const log = require('../common/log')

function installDesktopFile () {
  if (process.platform !== 'linux' || !process.env.APPIMAGE) {
    return
  }

  const appImagePath = process.env.APPIMAGE
  const home = os.homedir()
  const desktopId = 'electerm'
  const appsDir = path.join(home, '.local', 'share', 'applications')
  const iconsDir = path.join(
    home, '.local', 'share', 'icons',
    'hicolor', '128x128', 'apps'
  )
  const desktopFilePath = path.join(appsDir, `${desktopId}.desktop`)
  const iconFilePath = path.join(iconsDir, `${desktopId}.png`)

  // Icon source inside the AppImage (asar-aware path — Electron's fs
  // module transparently reads from inside app.asar)
  const srcIconPath = path.join(
    process.resourcesPath,
    'app.asar', 'assets', 'images', 'electerm-round-128x128.png'
  )

  const desktopContent = [
    '[Desktop Entry]',
    'Name=electerm',
    'Comment=Terminal/SSH/SFTP client',
    `Exec=${appImagePath} %U`,
    `Icon=${iconFilePath}`,
    'Terminal=false',
    'Type=Application',
    'Categories=Development;System;TerminalEmulator;',
    'StartupWMClass=electerm',
    'MimeType=x-scheme-handler/ssh;x-scheme-handler/telnet;' +
      'x-scheme-handler/rdp;x-scheme-handler/vnc;' +
      'x-scheme-handler/serial;x-scheme-handler/spice;' +
      'x-scheme-handler/electerm;',
    ''
  ].join('\n')

  try {
    // Skip if a system-level .desktop file exists (deb/rpm installs one
    // to /usr/share/applications/) — don't override it.
    // Also clean up any leftover user-level file from a previous AppImage run.
    const sysDesktop = '/usr/share/applications/electerm.desktop'
    if (fs.existsSync(sysDesktop)) {
      try {
        fs.unlinkSync(desktopFilePath)
        fs.unlinkSync(iconFilePath)
      } catch (_) {}
      return
    }

    // Skip if .desktop file already has the correct content
    let existing = ''
    try {
      existing = fs.readFileSync(desktopFilePath, 'utf8')
    } catch (_) {}
    if (existing === desktopContent) {
      return
    }

    fs.mkdirSync(appsDir, { recursive: true })
    fs.mkdirSync(iconsDir, { recursive: true })

    // Copy icon once (doesn't change between versions)
    if (!fs.existsSync(iconFilePath) && fs.existsSync(srcIconPath)) {
      fs.copyFileSync(srcIconPath, iconFilePath)
    }

    fs.writeFileSync(desktopFilePath, desktopContent)

    // Refresh desktop database so the DE picks up the new entry
    try {
      require('child_process').execSync(
        'update-desktop-database ~/.local/share/applications 2>/dev/null'
      )
    } catch (_) {}

    log.info(`[appimage] Installed .desktop file to ${desktopFilePath}`)
  } catch (e) {
    log.error('[appimage] Failed to install desktop file:', e.message)
  }
}

module.exports = { installDesktopFile }
