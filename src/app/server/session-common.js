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
      client.exec(cmd, this.getExecOpts(), (err, stream) => {
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
  // partial output with timedOut: true.
  Cls.prototype.execCommand = function (cmd, options = {}, conn) {
    return new Promise((resolve, reject) => {
      const { timeoutMs = 0 } = options || {}
      const client = conn || this.conn || this.client
      if (!client || typeof client.exec !== 'function') {
        reject(new Error('Exec channel not supported for this session type'))
        return
      }
      let timer = null
      client.exec(cmd, this.getExecOpts(), (err, stream) => {
        if (err) {
          reject(err)
          return
        }
        if (!stream) {
          resolve({ stdout: '', stderr: '', exitCode: null, timedOut: false })
          return
        }
        let stdout = ''
        let stderr = ''
        let exitCode = null
        let settled = false
        const done = (timedOut) => {
          if (settled) return
          settled = true
          if (timer) {
            clearTimeout(timer)
            timer = null
          }
          resolve({ stdout, stderr, exitCode, timedOut })
        }
        if (timeoutMs > 0) {
          timer = setTimeout(() => {
            try {
              stream.close()
            } catch (_) {
              // ignore — best effort channel close
            }
            done(true)
          }, timeoutMs)
        }
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
        stream.on('error', (e) => {
          if (timer) {
            clearTimeout(timer)
            timer = null
          }
          if (!settled) {
            settled = true
            reject(e)
          }
        })
      })
    })
  }
  return Cls
}
