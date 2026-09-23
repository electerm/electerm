/**
 * resolve local terminal info: os / hostname / kernel / arch / shell + version
 * uses the electron os module via window.pre.osInfo() (sync) and probes the
 * configured shell binary for its version through the local fs run bridge
 */

import { isMac, isWin } from '../../common/constants'
import fs from '../../common/fs'

function parseOsInfo (list) {
  const map = {}
  for (const { k, v } of list || []) {
    let val
    try {
      val = JSON.parse(v)
    } catch (e) {
      val = v
    }
    map[k] = Array.isArray(val) ? val.join(' ') : String(val)
  }
  return map
}

const shellNameReg = /(\w+)$/

function formatOsName (map) {
  const ver = map.release || ''
  if (isWin) {
    const main = parseInt(ver.split('.')[0], 10)
    if (main >= 10) {
      const build = parseInt(ver.split('.')[2], 10)
      return build >= 22000 ? `Windows 11 (${ver})` : `Windows 10 (${ver})`
    }
    return `Windows (${ver})`
  }
  if (isMac) {
    return `macOS ${map.version || ''}`.trim()
  }
  return `Linux ${ver}`.trim()
}

async function probeShellVersion (shellPath) {
  if (!shellPath) {
    return ''
  }
  try {
    let out = ''
    if (isWin) {
      // runWinCmd wraps the given script with powershell.exe -Command
      const res = await fs.runWinCmd(
        '$PSVersionTable.PSVersion.ToString()'
      ).catch(() => null)
      out = res?.stdout || ''
    } else {
      out = await fs.run(`'${shellPath.replace(/'/g, "'\\''")}' --version`).catch(() => '')
    }
    return (out || '').split('\n')[0].trim()
  } catch (e) {
    return ''
  }
}

export default async function resolveLocalInfo (pid) {
  const store = window.store
  if (!window.pre?.osInfo) {
    // web app build: no local os bridge available
    return null
  }
  const tab = store?.getTabs?.().find(t => t.id === pid)
  const config = store?.config || {}
  const execProp = isWin ? 'execWindows' : isMac ? 'execMac' : 'execLinux'
  // tab settings (bookmark) win over global config, same as terminal spawn logic
  const shellPath = tab?.[execProp] || config[execProp] || ''
  const shellBase = isWin
    ? (shellPath.split(/[\\/]/).pop() || '')
    : shellPath.split('/').pop() || ''
  const nameMatch = shellBase.match(shellNameReg)
  const shellName = nameMatch ? nameMatch[1] : shellBase
  const map = parseOsInfo(window.pre.osInfo())
  const shellVersion = await probeShellVersion(shellPath)
  return {
    os: formatOsName(map),
    hostname: map.hostname || '',
    kernel: isWin ? `Windows NT ${map.release || ''}`.trim() : (map.release || ''),
    arch: map.arch || '',
    shell: shellName,
    shellVersion
  }
}
