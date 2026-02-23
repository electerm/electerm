const bookmarkSchema = {
  ssh: {
    type: 'ssh',
    host: 'string (required) - hostname or IP address',
    port: 'number (default: 22) - SSH port',
    username: 'string (required) - SSH username',
    password: 'string - password for authentication',
    privateKey: 'string - private key content or path for key-based auth',
    passphrase: 'string - passphrase for private key/cetificate',
    certificate: 'string - certificate content',
    authType: 'string - auth type (password|privateKey|profiles)',
    profile: 'string - profile id to reuse saved auth',
    title: 'string - bookmark title',
    description: 'string - bookmark description',
    startDirectoryRemote: 'string - remote starting directory',
    startDirectoryLocal: 'string - local starting directory',
    enableSsh: 'boolean - enable ssh, default is true',
    enableSftp: 'boolean - enable sftp, default is true',
    sshTunnels: 'array - ssh tunnel definitions (see sshTunnels items)',
    connectionHoppings: 'array - connection hopping definitions',
    useSshAgent: 'boolean - use SSH agent, default is true',
    sshAgent: 'string - ssh agent path',
    serverHostKey: 'array - server host key algorithms',
    cipher: 'array - cipher list',
    runScripts: 'array - run scripts after connected ({delay,script})',
    quickCommands: 'array - quick commands ({name,command})',
    proxy: 'string - proxy address (socks5://...)',
    x11: 'boolean - enable x11 forwarding, default is false',
    term: 'string - terminal type, default is xterm-256color, required',
    displayRaw: 'boolean - display raw output, default is false',
    encode: 'string - charset, default is utf8',
    envLang: 'string - ENV LANG, default is en_US.UTF-8',
    setEnv: 'string - environment variables, format: `KEY1=VALUE1 KEY2=VALUE2`',
    color: 'string - tag color, like #000000',
    interactiveValues: 'strings separated by newline'
  },
  sshTunnelsItem: {
    sshTunnel: 'string - forwardRemoteToLocal|forwardLocalToRemote|dynamicForward',
    sshTunnelLocalHost: 'string',
    sshTunnelLocalPort: 'number',
    sshTunnelRemoteHost: 'string',
    sshTunnelRemotePort: 'number',
    name: 'string - optional tunnel name'
  },
  connectionHoppingsItem: {
    host: 'string',
    port: 'number',
    username: 'string',
    password: 'string',
    privateKey: 'string',
    passphrase: 'string - passphrase',
    certificate: 'string',
    authType: 'string',
    profile: 'string - profile id'
  },
  telnet: {
    type: 'telnet',
    host: 'string (required) - hostname or IP address',
    port: 'number (default: 23) - Telnet port',
    username: 'string - username',
    password: 'string - password',
    title: 'string - bookmark title',
    description: 'string - bookmark description',
    loginPrompt: 'string - login prompt regex',
    passwordPrompt: 'string - password prompt regex',
    runScripts: 'array - run scripts after connected ({delay,script})',
    startDirectoryRemote: 'string - remote starting directory',
    startDirectoryLocal: 'string - local starting directory',
    profile: 'string - profile id',
    proxy: 'string - proxy address (socks5://...)'
  },
  serial: {
    type: 'serial',
    path: 'string (required) - serial port path, e.g., /dev/ttyUSB0 or COM1',
    baudRate: 'number (default: 9600) - baud rate',
    dataBits: 'number (default: 8) - data bits',
    stopBits: 'number (default: 1) - stop bits',
    parity: 'string - "none", "even", "odd", "mark", "space"',
    title: 'string - bookmark title',
    rtscts: 'boolean - enable RTS/CTS flow control, default is false',
    xon: 'boolean - enable XON flow control, default is false',
    xoff: 'boolean - enable XOFF flow control, default is false',
    xany: 'boolean - enable XANY flow control, default is false',
    runScripts: 'array - run scripts after connected ({delay,script})',
    description: 'string - bookmark description'
  },
  vnc: {
    type: 'vnc',
    host: 'string (required) - hostname or IP address',
    port: 'number (default: 5900) - VNC port',
    username: 'string - VNC username',
    password: 'string - VNC password',
    viewOnly: 'boolean - view only mode, default is false',
    clipViewport: 'boolean - clip viewport to window, default is false',
    scaleViewport: 'boolean - scale viewport to window, default is true',
    qualityLevel: 'number (0-9) - VNC quality level, lower is faster, default is 3',
    compressionLevel: 'number (0-9) - VNC compression level, lower is faster, default is 1',
    shared: 'boolean - shared session, default is true',
    proxy: 'string - proxy address (socks5://...)',
    title: 'string - bookmark title',
    description: 'string - bookmark description',
    profile: 'string - profile id'
  },
  rdp: {
    type: 'rdp',
    host: 'string (required) - hostname or IP address',
    port: 'number (default: 3389) - RDP port',
    username: 'string - username',
    password: 'string - password',
    title: 'string - bookmark title',
    description: 'string - bookmark description',
    profile: 'string - profile id',
    proxy: 'string - proxy address (socks5://...)',
    domain: 'string - login domain'
  },
  ftp: {
    type: 'ftp',
    host: 'string (required) - hostname or IP address',
    port: 'number (default: 21) - FTP port',
    user: 'string - username',
    secure: 'boolean - use secure FTP (FTPS), default is false',
    password: 'string - password',
    title: 'string - bookmark title',
    profile: 'string - profile id',
    description: 'string - bookmark description'
  },
  web: {
    type: 'web',
    url: 'string (required) - website URL',
    title: 'string - bookmark title',
    description: 'string - bookmark description',
    useragent: 'string - custom user agent'
  },
  local: {
    type: 'local',
    title: 'string - bookmark title',
    description: 'string - bookmark description',
    startDirectoryLocal: 'string - local starting directory',
    runScripts: 'array - run scripts after connected ({delay,script})'
  },
  spice: {
    type: 'spice',
    host: 'string (required) - hostname or IP address',
    port: 'number (default: 5900) - Spice port',
    password: 'string - Spice password',
    title: 'string - bookmark title',
    viewOnly: 'boolean - view only mode, default is false',
    scaleViewport: 'boolean - scale viewport to window, default is true',
    description: 'string - bookmark description',
    profile: 'string - profile id',
    proxy: 'string - proxy address (socks5://...)'
  }
}

export function buildPrompt (description) {
  const lang = window.store.config.languageAI || window.store.getLangName()
  const schemaDescription = Object.entries(bookmarkSchema)
    .map(([type, fields]) => {
      const fieldList = Object.entries(fields)
        .map(([key, desc]) => `    ${key}: ${desc}`)
        .join('\n')
      return `  ${type}:\n${fieldList}`
    })
    .join('\n\n')

  return `You are a bookmark configuration generator. Based on the user's natural language description, generate bookmark configurations in JSON format.

Available bookmark types and their fields:
${schemaDescription}

Important rules:
1. Analyze the user's description to determine the most appropriate connection type
2. For SSH connections, use type "ssh" and default port 22 unless specified
3. For Telnet connections, use type "telnet" and default port 23 unless specified
4. For VNC connections, use type "vnc" and default port 5900 unless specified
5. For RDP connections, use type "rdp" and default port 3389 unless specified
6. For FTP connections, use type "ftp" and default port 21 unless specified
7. For Serial connections, use type "serial"
8. For Web/Browser connections, use type "web" with a URL field
9. For Local terminal, use type "local"
10. Only include fields that are relevant to the connection type
11. Always include a meaningful title if not specified
12. Respond ONLY with valid JSON, no markdown formatting or explanations
13. Reply in ${lang} language

User description: ${description}

Generate the bookmark JSON:`
}

export default bookmarkSchema
