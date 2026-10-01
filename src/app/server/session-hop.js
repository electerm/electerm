/**
 * Shared SSH connection-hopping utility.
 *
 * Creates a dynamic-SOCKS5 SSH tunnel through one or more hop servers
 * and returns the proxy URL to use for the final connection.
 *
 * Used by both VNC and RDP sessions.
 */

const uid = require('../common/uid')
const DANGEROUS_SESSION_FIELDS = require('../common/dangerous-session-fields')
const { session } = require('./session-ssh')

/**
 * A hop entry is spread into its sub-session's initOptions and used to be
 * passed through wholesale with `...hop`, which let a crafted
 * `connectionHoppings` entry smuggle `proxyCommand` into the hop session and
 * spawn it: the guard in session-ssh.js `maybeProxyCommandSock()` only skips
 * the proxy command while `connectionHoppings` is non-empty, and the pop below
 * leaves the innermost hop with an empty list.
 *
 * Strip the shared dangerous fields here as well as at the parse boundary -
 * this path is also reached from CLI `--opts` and MCP tool calls, which never
 * go through the quick connect parser.
 */
function withoutDangerousFields (hop) {
  const out = { ...(hop || {}) }
  DANGEROUS_SESSION_FIELDS.forEach(key => {
    delete out[key]
  })
  return out
}

function getPort (fromPort = 12023) {
  return new Promise((resolve, reject) => {
    require('find-free-port')(fromPort, '127.0.0.1', function (err, freePort) {
      if (err) {
        reject(err)
      } else {
        resolve(freePort)
      }
    })
  })
}

/**
 * Set up an SSH hop tunnel if connectionHoppings are configured.
 *
 * @param {object} initOptions - Session init options
 * @param {Array}  initOptions.connectionHoppings - Hop server definitions (mutated: last item is popped)
 * @param {string} [initOptions.proxy] - Existing proxy URL to chain through
 * @returns {Promise<{ proxyUrl: string|null, ssh: object|null }>}
 *   proxyUrl - SOCKS5 URL to use for the final connection, or original proxy, or null
 *   ssh      - SSH session that must be killed on cleanup, or null
 */
async function createHopProxy (initOptions) {
  const {
    proxy,
    connectionHoppings
  } = initOptions

  if (!connectionHoppings || !connectionHoppings.length) {
    return { proxyUrl: proxy || null, ssh: null }
  }

  const hop = connectionHoppings.pop()
  const fp = await getPort()

  const initOpts = {
    connectionHoppings,
    ...withoutDangerousFields(hop),
    hasHopping: true,
    cols: 80,
    rows: 24,
    term: 'xterm-256color',
    saveTerminalLogToFile: false,
    id: uid(),
    enableSsh: true,
    encode: 'utf-8',
    envLang: 'en_US.UTF-8',
    proxy,
    sshTunnels: [
      {
        sshTunnel: 'dynamicForward',
        sshTunnelLocalHost: '127.0.0.1',
        sshTunnelLocalPort: fp,
        id: uid()
      }
    ]
  }

  const ssh = await session(initOpts)
  return { proxyUrl: `socks5://127.0.0.1:${fp}`, ssh }
}

module.exports = { createHopProxy, getPort }
