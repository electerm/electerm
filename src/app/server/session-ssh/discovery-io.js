const { performance } = require('perf_hooks')

class DiscoveryTimeout extends Error {
  constructor () {
    super('jump-host key discovery timed out')
  }
}

function createDiscoveryIO (session, upstream) {
  let remaining = 15000

  // Charge only remote I/O. Between calls the generator may be suspended
  // while the destination authenticates a key or the user types a passphrase.
  async function run (operation) {
    if (remaining < 1) throw new DiscoveryTimeout()
    const start = performance.now()
    try {
      return await operation(Math.floor(remaining))
    } catch (err) {
      if (err instanceof DiscoveryTimeout) remaining = 0
      throw err
    } finally {
      remaining -= performance.now() - start
    }
  }

  function exec (command) {
    return run(async totalTimeoutMs => {
      const { stdout, stderr, exitCode, timedOut } = await session.execCommand(command, { totalTimeoutMs }, upstream)
      if (timedOut) throw new DiscoveryTimeout()
      if (exitCode !== null && exitCode !== 0) throw new Error(`command exited with status ${exitCode}`)
      if (stderr && (!stdout || exitCode === null)) throw new Error('command reported an error on stderr')
      return stdout
    })
  }

  function sftpRequest (client, method, ...args) {
    return run(timeout => new Promise((resolve, reject) => {
      let timedOut = false
      const timer = setTimeout(() => {
        timedOut = true
        reject(new DiscoveryTimeout())
      }, timeout)
      try {
        client[method](...args, (err, result) => {
          clearTimeout(timer)
          if (timedOut) {
            // A late subsystem channel still belongs to this request.
            if (method === 'sftp') result?.end()
            return
          }
          if (err) reject(err)
          else resolve(result)
        })
      } catch (err) {
        clearTimeout(timer)
        reject(err)
      }
    }))
  }

  return { exec, sftpRequest, hasTime: () => remaining >= 1 }
}

module.exports = { createDiscoveryIO, DiscoveryTimeout }
