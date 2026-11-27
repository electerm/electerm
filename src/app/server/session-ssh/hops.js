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
const listPublicKeys = 'sh -c \'if [ -d "$HOME/.ssh" ]; then cd "$HOME/.ssh" || exit 1; for key in *.pub; do if [ -f "$key" ]; then printf "%s\\0" "$key"; fi; done; fi\''
const discoveryTimeout = 15000

function readKeyCommand (name) {
  // PowerShell also treats typographic apostrophes as string delimiters.
  const quoted = "'" + name.replace(/['‘’‚‛]/g, quote => `'"${quote}"'`) + "'"
  return `cat "$HOME"/.ssh/${quoted}`
}

function sftpRequest (client, method, ...args) {
  return new Promise((resolve, reject) => {
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      reject(new Error('SFTP request timed out'))
    }, discoveryTimeout)
    try {
      client[method](...args, (err, result) => {
        clearTimeout(timer)
        if (timedOut && method === 'sftp') result?.end()
        if (err) reject(err)
        else resolve(result)
      })
    } catch (err) {
      clearTimeout(timer)
      reject(err)
    }
  })
}

async function * readKeys (names, read, options, tried) {
  let readError
  for (const name of names) {
    if (!name.endsWith('.pub') || name.includes('/') || name.includes('\0')) continue
    const keyName = name.slice(0, -4)
    if (!keyName || keyName === '.' || keyName === '..' || tried.has(keyName)) continue
    let privateKey
    try {
      privateKey = await read(keyName)
    } catch (err) {
      readError = err
      continue
    }
    if (privateKey) {
      tried.add(keyName)
      yield { options: { ...options, privateKey }, keyName }
    } else {
      readError = new Error('private key file was empty')
    }
  }
  if (readError) throw readError
}

async function * hopCredentials (session, upstream, options, discovery) {
  if (options.password || options.privateKey) {
    yield { options, keyName: options.privateKeyPath || 'privateKey' }
    return
  }
  // An available agent gets a chance before reading keys from the jump host.
  if (options.agent) yield { options }

  const tried = new Set()
  const exec = async command => {
    const { stdout, stderr, exitCode, timedOut } = await session.execCommand(command, { timeoutMs: discoveryTimeout }, upstream)
    if (timedOut) throw new Error('command timed out')
    if (exitCode !== null && exitCode !== 0) throw new Error(`command exited with status ${exitCode}`)
    if (stderr && (!stdout || exitCode === null)) throw new Error('command reported an error on stderr')
    return stdout
  }
  try {
    const names = (await exec(listPublicKeys)).split('\0')
    yield * readKeys(names, name => exec(readKeyCommand(name)), options, tried)
  } catch (shellError) {
    // SFTP paths are data, including on Windows hosts using PowerShell.
    let sftp
    try {
      sftp = await sftpRequest(upstream, 'sftp')
      const entries = await sftpRequest(sftp, 'readdir', '.ssh').catch(err => {
        if (err.code === 2) return [] // SSH_FX_NO_SUCH_FILE: no key directory.
        throw err
      })
      const names = entries.map(entry => entry.filename).filter(name => !name.includes('\\'))
      yield * readKeys(names,
        name => sftpRequest(sftp, 'readFile', '.ssh/' + name, 'utf8'), options, tried)
    } catch (err) {
      discovery.push(`sh: ${shellError.message}`, `SFTP: ${err.message}`)
    } finally {
      sftp?.end()
    }
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
  const discovery = []
  try {
    return await connectEndpoint(session, options, hopCredentials(session, upstream, options, discovery), settings)
  } catch (err) {
    if (discovery.length && !session.prompts.aborted &&
        /authentication methods failed|requires an interactive prompt/i.test(err.message)) {
      err.message += `. Could not discover or read jump-host keys (${discovery.join(', ')}). Check access to ~/.ssh on the jump host or configure credentials for the destination.`
    }
    throw err
  }
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
