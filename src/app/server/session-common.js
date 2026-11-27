/**
 * terminal/sftp/serial class
 */

exports.commonExtends = function (Cls) {
  Cls.prototype.customEnv = function (envs) {
    if (!envs) {
      return {}
    }
    return envs.split(' ').reduce((p, k) => {
      const [key, value] = k.split('=')
      if (key && value) {
        p[key] = value
      }
      return p
    }, {})
  }

  Cls.prototype.getEnv = function (initOptions = this.initOptions) {
    return {
      LANG: initOptions.envLang || 'en_US.UTF-8',
      ...this.customEnv(initOptions.setEnv)
    }
  }

  Cls.prototype.getExecOpts = function () {
    return {
      env: this.getEnv()
    }
  }

  Cls.prototype.runCmd = function (cmd, conn) {
    return new Promise((resolve, reject) => {
      const client = conn || this.conn || this.client
      // Watchdog: ssh2 may never invoke the exec callback on a dead
      // connection (channel-open queued forever). Fail fast instead of
      // hanging the caller forever.
      const openTimer = setTimeout(() => {
        reject(new Error('SSH exec channel did not open: connection lost or server not responding'))
      }, 15000)
      client.exec(cmd, this.getExecOpts(), (err, stream) => {
        clearTimeout(openTimer)
        if (err) reject(err)
        if (stream) {
          let r = ''
          stream
            .on('data', function (data) {
              const d = data.toString()
              r = r + d
            })
            .on('close', (code, signal) => {
              resolve(r)
            })
        } else {
          resolve('')
        }
      })
    })
  }

  // Structured command execution over an SSH exec channel.
  // Unlike runCmd (which merges stdout/stderr and drops the exit code),
  // execCommand captures both streams separately and resolves the real
  // exit code. Optional timeoutMs closes the channel early and resolves
  // partial output with timedOut: true. totalTimeoutMs puts channel opening
  // and execution under a single timeout.
  // The open watchdog rejects if ssh2 never invokes the exec callback
  // (channel-open queued forever on a dead connection) instead of hanging
  // until timeoutMs, so callers get a real error promptly.
  Cls.prototype.execCommand = function (cmd, options = {}, conn) {
    return new Promise((resolve, reject) => {
      const { timeoutMs = 0, openTimeoutMs = 15000, totalTimeoutMs = 0 } = options || {}
      const client = conn || this.conn || this.client
      if (!client || typeof client.exec !== 'function') {
        reject(new Error('Exec channel not supported for this session type'))
        return
      }
      let timer = null
      let openTimer = null
      let settled = false
      let stream
      let stdout = ''
      let stderr = ''
      let exitCode = null
      const clearTimers = () => {
        if (timer) {
          clearTimeout(timer)
          timer = null
        }
        if (openTimer) {
          clearTimeout(openTimer)
          openTimer = null
        }
      }
      const fail = (e) => {
        if (settled) {
          return
        }
        settled = true
        clearTimers()
        reject(e)
      }
      const done = timedOut => {
        if (settled) {
          return
        }
        settled = true
        clearTimers()
        resolve({ stdout, stderr, exitCode, timedOut })
      }
      const closeChannel = channel => {
        try {
          channel?.close?.()
        } catch (_) {}
      }
      const onTimeout = () => {
        done(true)
        closeChannel(stream)
      }
      // Discovery has one deadline for both phases. Other callers give
      // channel opening and command execution separate timeouts.
      if (totalTimeoutMs > 0) {
        timer = setTimeout(onTimeout, totalTimeoutMs)
      } else {
        openTimer = setTimeout(() => {
          fail(new Error('SSH exec channel did not open: connection lost or server not responding'))
        }, openTimeoutMs)
      }
      const onOpen = (err, channel) => {
        if (openTimer) {
          clearTimeout(openTimer)
          openTimer = null
        }
        if (settled) {
          closeChannel(channel)
          return
        }
        if (err) {
          fail(err)
          return
        }
        stream = channel
        if (!stream) {
          done(false)
          return
        }
        if (timeoutMs > 0 && totalTimeoutMs <= 0) timer = setTimeout(onTimeout, timeoutMs)
        stream.on('data', (data) => {
          stdout += data.toString()
        })
        if (stream.stderr) {
          stream.stderr.on('data', (data) => {
            stderr += data.toString()
          })
        }
        stream.on('exit', (code) => {
          exitCode = typeof code === 'number' ? code : null
        })
        stream.on('close', () => done(false))
        stream.on('error', (e) => fail(e))
      }
      try {
        client.exec(cmd, this.getExecOpts(), onOpen)
      } catch (err) {
        fail(err)
      }
    })
  }
  return Cls
}
