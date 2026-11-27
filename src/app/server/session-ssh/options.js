const fs = require('fs')
const os = require('os')
const path = require('path')
const { pick } = require('../../lib/lodash')
const log = require('../../common/log')
const { algDefault } = require('../ssh2-alg')

const endpointFields = [
  'host', 'port', 'username', 'password', 'privateKey', 'privateKeyPath',
  'passphrase', 'certificate', 'certificatePath'
]

function resolveKeyFiles (options) {
  for (const key of ['privateKey', 'certificate']) {
    const rawPath = options[key + 'Path']
    const file = typeof rawPath === 'string' ? rawPath.trim() : ''
    if (!file || options[key]) continue
    const expanded = /^~(?:$|[/\\])/.test(file) ? path.resolve(os.homedir(), file.slice(2)) : file
    try {
      options[key] = fs.readFileSync(expanded, 'utf8')
    } catch (err) {
      // Imported password bookmarks can still point at a key from another machine.
      if (!options.password) throw new Error(`cannot read ${key} file ${file}: ${err.message}`)
      log.warn(`skip unreadable ${key} file, a password is saved`, file, err.message)
    }
  }
  return options
}

function getAgentOptions ({ useSshAgent, sshAgent, agentForward }) {
  const agent = useSshAgent !== false ? sshAgent || process.env.SSH_AUTH_SOCK : undefined
  return agent && agentForward === true ? { agent, agentForward } : { agent }
}

function getShareOptions (initOptions) {
  const algorithms = algDefault()
  for (const key of ['serverHostKey', 'cipher', 'compress']) {
    if (initOptions[key]?.length) algorithms[key] = initOptions[key].slice()
  }
  return {
    ...pick(initOptions, ['readyTimeout', 'keepaliveCountMax', 'keepaliveInterval']),
    tryKeyboard: true,
    algorithms
  }
}

function buildConnectOptions (initOptions) {
  const options = resolveKeyFiles({
    ...getShareOptions(initOptions),
    ...getAgentOptions(initOptions),
    ...pick(initOptions, [...endpointFields, 'encode'])
  })
  if (!options.passphrase) delete options.passphrase
  if ('debug' in initOptions) log.setDebugMode(!!initOptions.debug)
  if (initOptions.debug) options.debug = log.log
  return options
}

module.exports = { buildConnectOptions, endpointFields, getAgentOptions, getShareOptions, resolveKeyFiles }
