import { canUseNativeRdp } from './platform.js'

const ports = new Set()

// Tab records also hold passwords, commands, environment variables and live
// session state. Review new fields here before sending them to widget code.
const publicFields = [
  'srcId', 'from', 'pane', 'batch', 'tabCount', 'isPinned', 'isTransporting',
  'isEditting', 'mcpStatus', 'category', 'color', 'icon', 'fontFamily', 'fontSize',
  'host', 'port', 'username', 'user', 'domain', 'authType', 'profile',
  'startDirectory', 'startDirectoryLocal', 'autoReConnect', 'keepaliveEnabled',
  'keepaliveInterval', 'enableSsh', 'enableSftp', 'sshSftpSplitView',
  'useSshAgent', 'agentForward', 'x11', 'isMFA', 'ignoreKeyboardInteractive',
  'usePasswordManager', 'notifyOnData',
  'enableTerminalImage', 'term', 'encode', 'envLang', 'displayRaw',
  'secure', 'tls', 'hostSubject', 'nla', 'viewOnly', 'clipViewport', 'scaleViewport',
  'qualityLevel', 'compressionLevel', 'shared', 'hideAddressBar', 'useragent',
  'path', 'baudRate', 'dataBits', 'stopBits', 'parity', 'lock', 'rtscts', 'xon',
  'xoff', 'xany', 'txLineEnding', 'rxLineEnding', 'closeSequenceDelay'
]

function publicTab (tab) {
  const result = {
    id: tab.id,
    type: typeof tab.type === 'string' && tab.type ? tab.type : (tab.host ? 'ssh' : 'local'),
    title: typeof tab.title === 'string' ? tab.title : '',
    status: typeof tab.status === 'string' ? tab.status : ''
  }
  for (const key of publicFields) {
    const value = tab[key]
    if (typeof value === 'string' || typeof value === 'boolean' || Number.isFinite(value)) {
      result[key] = value
    }
  }
  for (const key of ['serverHostKey', 'cipher', 'compress']) {
    const value = tab[key]
    if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
      result[key] = [...value]
    }
  }
  if (typeof tab.nativeRdp === 'boolean') {
    result.nativeRdp = tab.nativeRdp && canUseNativeRdp()
  }
  return result
}

export function publishTabEvent (event, tab) {
  if (!ports.size || typeof tab.id !== 'string') {
    return
  }
  const snapshot = publicTab(tab)
  for (const port of ports) {
    port.postMessage({ event, tab: snapshot })
  }
}

// A port belongs to one widget document in one app window. Messages queue
// while its scripts are loading, and removing the frame revokes the port.
export function widgetTabChannel () {
  const { port1, port2 } = new MessageChannel()
  ports.add(port1)
  port1.onmessage = ({ data }) => {
    if (!ports.has(port1)) {
      return
    }
    if (data?.method === 'closeTab' && typeof data.id === 'string') {
      window.store.delTab(data.id)
    }
  }
  return {
    connect (frame) {
      frame.contentWindow.postMessage(null, '*', [port2])
    },
    dispose () {
      ports.delete(port1)
      port1.close()
      port2.close()
    }
  }
}
