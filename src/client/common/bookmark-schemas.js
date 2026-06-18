/**
 * Bookmark schemas (ES module version for client)
 * Mirrors src/app/common/bookmark-zod-schemas.js with additional types
 */
import { z } from './zod'

// const runScriptSchema = z.object({
//   delay: z.number().optional().describe('Delay in ms before executing this command'),
//   script: z.string().describe('Command to execute')
// })

const quickCommandSchema = z.object({
  name: z.string().describe('Quick command name'),
  command: z.string().describe('Command')
})

const sshTunnelSchema = z.object({
  sshTunnel: z.enum(['forwardRemoteToLocal', 'forwardLocalToRemote', 'dynamicForward']).describe('Tunnel type'),
  sshTunnelLocalHost: z.string().optional().describe('Local host'),
  sshTunnelLocalPort: z.number().optional().describe('Local port'),
  sshTunnelRemoteHost: z.string().optional().describe('Remote host'),
  sshTunnelRemotePort: z.number().optional().describe('Remote port'),
  name: z.string().optional().describe('Tunnel name')
})

const connectionHoppingSchema = z.object({
  host: z.string().describe('Host address'),
  port: z.number().optional().describe('Port number'),
  username: z.string().optional().describe('Username'),
  password: z.string().optional().describe('Password'),
  privateKey: z.string().optional().describe('Private key'),
  passphrase: z.string().optional().describe('Passphrase'),
  certificate: z.string().optional().describe('Certificate'),
  authType: z.string().optional().describe('Auth type'),
  profile: z.string().optional().describe('Profile id')
})

const commonNetworkBookmarkProps = {
  title: z.string().describe('Bookmark title'),
  host: z.string().describe('Host address'),
  port: z.number().optional().describe('Port number'),
  username: z.string().optional().describe('Username'),
  password: z.string().optional().describe('Password'),
  description: z.string().optional().describe('Bookmark description'),
  startDirectoryRemote: z.string().optional().describe('Remote starting directory'),
  startDirectoryLocal: z.string().optional().describe('Local starting directory'),
  profile: z.string().optional().describe('Profile id'),
  proxy: z.string().optional().describe('Proxy address (socks5://...)')
}

export const sshBookmarkSchema = {
  ...commonNetworkBookmarkProps,
  host: z.string().describe('SSH host address'),
  port: z.number().optional().describe('SSH port (default 22)'),
  username: z.string().optional().describe('SSH username'),
  password: z.string().optional().describe('SSH password'),
  authType: z.enum(['password', 'privateKey', 'profiles']).optional().describe('Authentication type'),
  privateKey: z.string().optional().describe('Private key content or path (for privateKey auth)'),
  passphrase: z.string().optional().describe('Passphrase for private key/certificate'),
  certificate: z.string().optional().describe('Certificate content'),
  enableSsh: z.boolean().optional().describe('Enable ssh, default is true'),
  enableSftp: z.boolean().optional().describe('Enable sftp, default is true'),
  useSshAgent: z.boolean().optional().describe('Use SSH agent, default is true'),
  sshAgent: z.string().optional().describe('SSH agent path'),
  serverHostKey: z.array(z.string()).optional().describe('Server host key algorithms'),
  cipher: z.array(z.string()).optional().describe('Cipher list'),
  compress: z.array(z.string()).optional().describe('Compression algorithms'),
  quickCommands: z.array(quickCommandSchema).optional().describe('Quick commands'),
  x11: z.boolean().optional().describe('Enable x11 forwarding, default is false'),
  term: z.string().optional().describe('Terminal type, default is xterm-256color'),
  displayRaw: z.boolean().optional().describe('Display raw output, default is false'),
  encode: z.string().optional().describe('Charset, default is utf8'),
  envLang: z.string().optional().describe('ENV LANG, default is en_US.UTF-8'),
  color: z.string().optional().describe('Tag color, like #000000'),
  sshTunnels: z.array(sshTunnelSchema).optional().describe('SSH tunnel definitions'),
  connectionHoppings: z.array(connectionHoppingSchema).optional().describe('Connection hopping definitions')
}

export const telnetBookmarkSchema = {
  ...commonNetworkBookmarkProps,
  host: z.string().describe('Telnet host address'),
  port: z.number().optional().describe('Telnet port (default 23)'),
  username: z.string().optional().describe('Telnet username'),
  password: z.string().optional().describe('Telnet password'),
  loginPrompt: z.string().optional().describe('Login prompt regex'),
  passwordPrompt: z.string().optional().describe('Password prompt regex')
}

export const serialBookmarkSchema = {
  title: z.string().describe('Bookmark title'),
  path: z.string().describe('Serial device path, e.g., /dev/ttyUSB0 or COM1'),
  baudRate: z.number().optional().describe('Baud rate (default 9600)'),
  dataBits: z.number().optional().describe('Data bits (default 8)'),
  stopBits: z.number().optional().describe('Stop bits (default 1)'),
  parity: z.enum(['none', 'even', 'odd', 'mark', 'space']).optional().describe('Parity (default none)'),
  rtscts: z.boolean().optional().describe('RTS/CTS flow control'),
  xon: z.boolean().optional().describe('XON flow control'),
  xoff: z.boolean().optional().describe('XOFF flow control'),
  xany: z.boolean().optional().describe('XANY flow control'),
  txLineEnding: z.enum(['\r', '\n', '\r\n']).optional().describe('TX line ending appended on Enter: "\\r" (CR, default), "\\n" (LF), "\\r\\n" (CR+LF)'),
  rxLineEnding: z.enum(['none', 'lf_to_crlf', 'cr_to_crlf']).optional().describe('RX line ending conversion: "none" (pass-through, default), "lf_to_crlf" (LF→CRLF for LF-only devices), "cr_to_crlf" (CR→CRLF for CR-only devices)'),
  description: z.string().optional().describe('Bookmark description')
}

export const vncBookmarkSchema = {
  ...commonNetworkBookmarkProps,
  host: z.string().describe('VNC host address'),
  port: z.number().optional().describe('VNC port (default 5900)'),
  viewOnly: z.boolean().optional().describe('View only mode, default is false'),
  clipViewport: z.boolean().optional().describe('Clip viewport to window'),
  scaleViewport: z.boolean().optional().describe('Scale viewport to window, default is true'),
  qualityLevel: z.number().optional().describe('VNC quality level 0-9, lower is faster, default 3'),
  compressionLevel: z.number().optional().describe('VNC compression level 0-9, lower is faster, default 1'),
  shared: z.boolean().optional().describe('Shared session, default is true')
}

export const rdpBookmarkSchema = {
  ...commonNetworkBookmarkProps,
  host: z.string().describe('RDP host address'),
  port: z.number().optional().describe('RDP port (default 3389)'),
  domain: z.string().optional().describe('Login domain')
}

export const ftpBookmarkSchema = {
  title: z.string().describe('Bookmark title'),
  host: z.string().describe('FTP host address'),
  port: z.number().optional().describe('FTP port (default 21)'),
  user: z.string().optional().describe('FTP username'),
  password: z.string().optional().describe('FTP password'),
  secure: z.boolean().optional().describe('Use secure FTP (FTPS), default is false'),
  encode: z.string().optional().describe('Charset for file names, default is utf-8'),
  profile: z.string().optional().describe('Profile id'),
  description: z.string().optional().describe('Bookmark description')
}

export const webBookmarkSchema = {
  url: z.string().describe('Website URL'),
  title: z.string().optional().describe('Bookmark title'),
  description: z.string().optional().describe('Bookmark description'),
  useragent: z.string().optional().describe('Custom user agent')
}

export const localBookmarkSchema = {
  title: z.string().describe('Bookmark title'),
  description: z.string().optional().describe('Bookmark description'),
  startDirectoryLocal: z.string().optional().describe('Local starting directory')
}

export const spiceBookmarkSchema = {
  ...commonNetworkBookmarkProps,
  host: z.string().describe('Spice host address'),
  port: z.number().optional().describe('Spice port (default 5900)'),
  viewOnly: z.boolean().optional().describe('View only mode'),
  scaleViewport: z.boolean().optional().describe('Scale viewport to window, default is true')
}

export const bookmarkSchemas = {
  ssh: sshBookmarkSchema,
  telnet: telnetBookmarkSchema,
  serial: serialBookmarkSchema,
  vnc: vncBookmarkSchema,
  rdp: rdpBookmarkSchema,
  ftp: ftpBookmarkSchema,
  web: webBookmarkSchema,
  local: localBookmarkSchema,
  spice: spiceBookmarkSchema
}
