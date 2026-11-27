const { connectEndpoint } = require('./connect')
const { createDiscoveryIO, DiscoveryTimeout } = require('./discovery-io')
const { endpointFields, getAgentOptions, getShareOptions, isIdentityPublicKey, resolveKeyFiles } = require('./options')

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

function readKeyCommand (name) {
  // PowerShell also treats typographic apostrophes as string delimiters.
  const quoted = "'" + name.replace(/['‘’‚‛]/g, quote => `'"${quote}"'`) + "'"
  return `cat "$HOME"/.ssh/${quoted}`
}

function unavailableKeysNotice (details) {
  return `Could not discover or read jump-host keys (${details}). Check access to ~/.ssh on the jump host or configure credentials for the destination.`
}

function errorMessage (err) {
  return String(err?.message ?? err)
}

async function * readKeys (names, read, options, discovery) {
  const failures = []
  let foundKey = false
  for (const name of names) {
    if (!isIdentityPublicKey(name) || name.includes('/') || name.includes('\0')) continue
    const keyName = name.slice(0, -4)
    if (!keyName || keyName === '.' || keyName === '..') continue
    let privateKey
    try {
      privateKey = await read(keyName)
    } catch (err) {
      const quotedKey = JSON.stringify(keyName)
      if (err instanceof DiscoveryTimeout) {
        if (!foundKey) {
          err.message += ` while reading ${quotedKey}`
          if (failures.length) err.message += `. Earlier key reads failed (${failures.join(', ')})`
          throw err
        }
        discovery.notice = `Jump-host key discovery stopped early because reading ${quotedKey} timed out.`
        return
      }
      failures.push(`${quotedKey}: ${errorMessage(err)}`)
      continue
    }
    if (privateKey) {
      foundKey = true
      yield { options: { ...options, privateKey }, keyName }
    } else {
      failures.push(`${JSON.stringify(keyName)}: private key file was empty`)
    }
  }
  // An orphaned .pub does not invalidate keys already offered to the destination.
  if (!foundKey && failures.length) {
    throw new Error(`could not read any listed private key: ${failures.join(', ')}`)
  }
}

async function * hopCredentials (session, upstream, options, discovery) {
  if (options.password || options.privateKey) {
    yield { options, keyName: options.privateKeyPath || 'privateKey' }
    return
  }
  // An available agent gets a chance before reading keys from the jump host.
  if (options.agent) yield { options }

  const { exec, sftpRequest, hasTime } = createDiscoveryIO(session, upstream)
  try {
    const names = (await exec(listPublicKeys)).split('\0')
    yield * readKeys(names, name => exec(readKeyCommand(name)), options, discovery)
  } catch (shellError) {
    if (!hasTime()) {
      discovery.notice = unavailableKeysNotice(`sh: ${errorMessage(shellError)}`)
    } else {
      // SFTP paths are data, including on Windows hosts using PowerShell.
      let sftp
      try {
        sftp = await sftpRequest(upstream, 'sftp')
        const entries = await sftpRequest(sftp, 'readdir', '.ssh').catch(err => {
          if (err?.code === 2) return [] // SSH_FX_NO_SUCH_FILE: no key directory.
          throw err
        })
        const names = entries.map(entry => entry.filename).filter(name => !name.includes('\\'))
        yield * readKeys(names,
          name => sftpRequest(sftp, 'readFile', '.ssh/' + name, 'utf8'), options, discovery)
      } catch (err) {
        discovery.notice = unavailableKeysNotice(`sh: ${errorMessage(shellError)}, SFTP: ${errorMessage(err)}`)
      } finally {
        sftp?.end()
      }
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
  const discovery = {}
  try {
    return await connectEndpoint(session, options, hopCredentials(session, upstream, options, discovery), settings)
  } catch (err) {
    if (discovery.notice && !session.prompts.aborted && typeof err?.message === 'string' &&
        /authentication methods failed|requires an interactive prompt/i.test(err.message)) {
      err.message += `. ${discovery.notice}`
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
