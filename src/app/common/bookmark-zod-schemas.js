const { z } = require('zod')

const runScriptSchema = z.object({
  delay: z.number().optional().describe('Delay in ms before executing this command'),
  script: z.string().describe('Command to execute')
})

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
  runScripts: z.array(runScriptSchema).optional().describe('Run scripts after connected'),
  startDirectoryRemote: z.string().optional().describe('Remote starting directory'),
  startDirectoryLocal: z.string().optional().describe('Local starting directory'),
  profile: z.string().optional().describe('Profile id'),
  proxy: z.string().optional().describe('Proxy address (socks5://...)')
}

const sshBookmarkSchema = {
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
  quickCommands: z.array(quickCommandSchema).optional().describe('Quick commands'),
  x11: z.boolean().optional().describe('Enable x11 forwarding, default is false'),
  term: z.string().optional().describe('Terminal type, default is xterm-256color'),
  displayRaw: z.boolean().optional().describe('Display raw output, default is false'),
  encode: z.string().optional().describe('Charset, default is utf8'),
  envLang: z.string().optional().describe('ENV LANG, default is en_US.UTF-8'),
  setEnv: z.string().optional().describe('Environment variables, format: KEY1=VALUE1 KEY2=VALUE2'),
  color: z.string().optional().describe('Tag color, like #000000'),
  interactiveValues: z.string().optional().describe('Strings separated by newline'),
  sshTunnels: z.array(sshTunnelSchema).optional().describe('SSH tunnel definitions'),
  connectionHoppings: z.array(connectionHoppingSchema).optional().describe('Connection hopping definitions')
}

const telnetBookmarkSchema = {
  ...commonNetworkBookmarkProps,
  host: z.string().describe('Telnet host address'),
  port: z.number().optional().describe('Telnet port (default 23)'),
  username: z.string().optional().describe('Telnet username'),
  password: z.string().optional().describe('Telnet password'),
  loginPrompt: z.string().optional().describe('Login prompt regex'),
  passwordPrompt: z.string().optional().describe('Password prompt regex')
}

const serialBookmarkSchema = {
  title: z.string().describe('Bookmark title'),
  path: z.string().describe('Serial device path'),
  baudRate: z.number().optional().describe('Baud rate (default 9600)'),
  dataBits: z.number().optional().describe('Data bits (default 8)'),
  stopBits: z.number().optional().describe('Stop bits (default 1)'),
  parity: z.enum(['none', 'even', 'odd', 'mark', 'space']).optional().describe('Parity (default none)'),
  rtscts: z.boolean().optional().describe('RTS/CTS flow control'),
  xon: z.boolean().optional().describe('XON flow control'),
  xoff: z.boolean().optional().describe('XOFF flow control'),
  xany: z.boolean().optional().describe('XANY flow control'),
  description: z.string().optional().describe('Bookmark description'),
  runScripts: z.array(runScriptSchema).optional().describe('Run scripts after connected')
}

const localBookmarkSchema = {
  title: z.string().describe('Bookmark title'),
  description: z.string().optional().describe('Bookmark description'),
  startDirectoryLocal: z.string().optional().describe('Local starting directory'),
  runScripts: z.array(runScriptSchema).optional().describe('Run scripts after connected')
}

module.exports = {
  runScriptSchema,
  quickCommandSchema,
  sshTunnelSchema,
  connectionHoppingSchema,
  commonNetworkBookmarkProps,
  sshBookmarkSchema,
  telnetBookmarkSchema,
  serialBookmarkSchema,
  localBookmarkSchema
}
