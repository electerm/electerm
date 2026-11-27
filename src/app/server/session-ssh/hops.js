const log = require('../../common/log')
const { connectEndpoint } = require('./connect')
const { endpointFields, getAgentOptions, getShareOptions, resolveKeyFiles } = require('./options')

function firstHopOptions (options) {
  const result = { ...options }
  if (!options.hasHopping || !options.connectionHoppings?.length) return result

  const [first, ...rest] = options.connectionHoppings
  const destination = {}
  for (const field of endpointFields) {
    destination[field] = options[field]
    result[field] = first[field]
  }
  result.connectionHoppings = [...rest, destination]
  return result
}

// The login shell may be fish or tcsh. Run the fixed glob in sh and preserve
// filename boundaries (including spaces/newlines) across the exec channel.
const listPublicKeys = 'sh -c \'cd "$HOME/.ssh" && for key in *.pub; do [ -f "$key" ] && printf "%s\\0" "$key"; done\''

async function * hopCredentials (session, upstream, options) {
  if (options.password || options.privateKey) {
    yield { options, keyName: options.privateKeyPath || 'privateKey' }
    return
  }
  // An available agent gets a chance before reading keys from the jump host.
  if (options.agent) yield { options }

  const output = await session.runCmd(listPublicKeys, upstream).catch(err => {
    log.error('could not list jump host keys', err)
    return ''
  })
  for (const name of output.split('\0')) {
    if (!name.endsWith('.pub') || name.includes('/')) continue
    const keyName = name.slice(0, -4)
    if (!keyName || keyName === '.' || keyName === '..') continue
    const quoted = "'" + keyName.replace(/'/g, "'\\''") + "'"
    const privateKey = await session.runCmd(`cat "$HOME"/.ssh/${quoted}`, upstream)
    if (privateKey) yield { options: { ...options, privateKey }, keyName }
  }
  // Keyboard-interactive and servers accepting "none" also work without keys.
  if (!options.agent) yield { options }
}

async function connectHop (session, upstream, hop, forwardX11) {
  const { host, port = 22, ...credentials } = hop
  const target = { host, port }
  const settings = { upstream, target, forwardX11 }
  const options = resolveKeyFiles({
    ...credentials,
    ...getAgentOptions(session.initOptions),
    ...getShareOptions(session.initOptions)
  })
  return connectEndpoint(session, options, hopCredentials(session, upstream, options), settings)
}

async function connectHops (session, hops) {
  session.conns = []
  for (const [index, hop] of hops.entries()) {
    const upstream = session.conn
    const downstream = await connectHop(session, upstream, hop, index === hops.length - 1)
    session.conns.push(upstream)
    session.conn = downstream
  }
}

module.exports = { connectHops, firstHopOptions }
