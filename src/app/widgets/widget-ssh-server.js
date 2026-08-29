const os = require('os')
const path = require('path')
const { exec } = require('child_process')
const uid = require('../common/uid')
const { Server, utils } = require('@electerm/ssh2')

const widgetInfo = {
  name: 'SSH Server',
  description: 'A local SSH server (backed by @electerm/ssh2) for quickly testing SSH/SFTP connections against this machine.',
  version: '1.0.0',
  author: 'ZHAO Xudong',
  type: 'instance',
  builtin: true,
  configs: [
    {
      name: 'host',
      type: 'string',
      default: '127.0.0.1',
      description: 'The IP address to bind the SSH server to'
    },
    {
      name: 'port',
      type: 'number',
      default: 22225,
      description: 'The port number to listen on'
    },
    {
      name: 'username',
      type: 'string',
      default: 'test',
      description: 'Username for SSH authentication'
    },
    {
      name: 'password',
      type: 'string',
      default: 'test',
      showGenerator: true,
      description: 'Password for SSH authentication'
    },
    {
      name: 'directory',
      type: 'string',
      default: os.homedir(),
      description: 'Directory exposed over SFTP and used as the shell/exec working directory (default: user\'s home directory)'
    },
    {
      name: 'autoRun',
      type: 'boolean',
      default: false,
      description: 'Automatically start this SSH server when the app launches'
    }
  ]
}

function getDefaultConfig () {
  return widgetInfo.configs.reduce((acc, config) => {
    acc[config.name] = config.default
    return acc
  }, {})
}

function getDefaultShell () {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'powershell.exe'
  }
  return process.env.SHELL || '/bin/bash'
}

// SFTP subsystem confined to rootDir, mirrors src/test/integration/lib/ssh-test-server.js
function attachSftp (sftp, rootDir) {
  const { STATUS_CODE } = utils.sftp
  const fs = require('fs')
  let handleCount = 0
  const openFiles = new Map()
  const openDirs = new Map()

  const fail = (reqID, err) => {
    sftp.status(reqID, err && err.code === 'ENOENT' ? STATUS_CODE.NO_SUCH_FILE : STATUS_CODE.FAILURE)
  }
  const confine = (p) => {
    const rel = path.posix.normalize(`/${p || '/'}`)
    const abs = path.join(rootDir, rel)
    if (!abs.startsWith(rootDir)) {
      throw new Error('path escapes root')
    }
    return abs
  }
  const toAttrs = (st) => ({
    mode: st.mode,
    uid: st.uid,
    gid: st.gid,
    size: st.size,
    atime: Math.floor(st.atimeMs / 1000),
    mtime: Math.floor(st.mtimeMs / 1000)
  })

  sftp.on('REALPATH', (reqID, p) => {
    sftp.name(reqID, [{ filename: path.posix.normalize(`/${p || '/'}`), longname: '', attrs: {} }])
  })

  sftp.on('STAT', (reqID, p) => {
    fs.stat(confine(p), (err, st) => {
      if (err) return fail(reqID, err)
      sftp.attrs(reqID, toAttrs(st))
    })
  })

  sftp.on('LSTAT', (reqID, p) => {
    fs.lstat(confine(p), (err, st) => {
      if (err) return fail(reqID, err)
      sftp.attrs(reqID, toAttrs(st))
    })
  })

  sftp.on('OPENDIR', (reqID, p) => {
    fs.readdir(confine(p), { withFileTypes: true }, (err, entries) => {
      if (err) return fail(reqID, err)
      const handle = Buffer.from(`dir-${++handleCount}`)
      openDirs.set(handle.toString(), { entries, sent: false })
      sftp.handle(reqID, handle)
    })
  })

  sftp.on('READDIR', (reqID, handle) => {
    const dir = openDirs.get(handle.toString())
    if (!dir) return sftp.status(reqID, STATUS_CODE.FAILURE)
    if (dir.sent) return sftp.status(reqID, STATUS_CODE.EOF)
    dir.sent = true
    const names = dir.entries.map(en => ({
      filename: en.name,
      longname: en.name,
      attrs: {}
    }))
    sftp.name(reqID, names)
  })

  sftp.on('OPEN', (reqID, filename, pflags) => {
    const flags = utils.sftp.flagsToString(pflags)
    fs.open(confine(filename), flags, (err, fd) => {
      if (err) return fail(reqID, err)
      const handle = Buffer.from(`file-${++handleCount}`)
      openFiles.set(handle.toString(), { fd })
      sftp.handle(reqID, handle)
    })
  })

  sftp.on('READ', (reqID, handle, offset, len) => {
    const f = openFiles.get(handle.toString())
    if (!f) return sftp.status(reqID, STATUS_CODE.FAILURE)
    const buf = Buffer.alloc(len)
    fs.read(f.fd, buf, 0, len, offset, (err, bytesRead) => {
      if (err) return sftp.status(reqID, STATUS_CODE.FAILURE)
      if (bytesRead === 0) return sftp.status(reqID, STATUS_CODE.EOF)
      sftp.data(reqID, buf.slice(0, bytesRead))
    })
  })

  sftp.on('WRITE', (reqID, handle, offset, data) => {
    const f = openFiles.get(handle.toString())
    if (!f) return sftp.status(reqID, STATUS_CODE.FAILURE)
    fs.write(f.fd, data, 0, data.length, offset, (err) => {
      if (err) return sftp.status(reqID, STATUS_CODE.FAILURE)
      sftp.status(reqID, STATUS_CODE.OK)
    })
  })

  sftp.on('CLOSE', (reqID, handle) => {
    const key = handle.toString()
    const f = openFiles.get(key)
    openFiles.delete(key)
    openDirs.delete(key)
    if (!f) return sftp.status(reqID, STATUS_CODE.OK)
    fs.close(f.fd, () => sftp.status(reqID, STATUS_CODE.OK))
  })

  sftp.on('REMOVE', (reqID, p) => {
    fs.unlink(confine(p), (err) => {
      if (err) return fail(reqID, err)
      sftp.status(reqID, STATUS_CODE.OK)
    })
  })

  sftp.on('MKDIR', (reqID, p) => {
    fs.mkdir(confine(p), { recursive: true }, (err) => {
      if (err) return fail(reqID, err)
      sftp.status(reqID, STATUS_CODE.OK)
    })
  })
}

function widgetRun (instanceConfig) {
  const config = { ...getDefaultConfig(), ...instanceConfig }
  const instanceId = uid()
  let server = null
  const activePtys = new Set()

  const attachSession = (client) => {
    client.on('session', (accept) => {
      const session = accept()
      let ptyCols = 80
      let ptyRows = 24
      let term = null

      session.on('pty', (acceptPty, rejectPty, info) => {
        if (info) {
          ptyCols = info.cols || ptyCols
          ptyRows = info.rows || ptyRows
        }
        if (acceptPty) acceptPty()
      })

      session.on('window-change', (acceptChange, rejectChange, info) => {
        if (term && info) {
          term.resize(info.cols, info.rows)
        }
        if (acceptChange) acceptChange()
      })

      session.on('shell', (acceptShell) => {
        const stream = acceptShell()
        const pty = require('node-pty')
        term = pty.spawn(getDefaultShell(), [], {
          name: 'xterm-256color',
          cols: ptyCols,
          rows: ptyRows,
          cwd: config.directory,
          env: process.env
        })
        activePtys.add(term)
        term.onData(data => stream.write(data))
        stream.on('data', data => term.write(data.toString('utf8')))
        stream.on('close', () => term && term.kill())
        term.onExit(({ exitCode }) => {
          activePtys.delete(term)
          stream.exit(exitCode || 0)
          stream.end()
        })
      })

      session.on('exec', (acceptExec, rejectExec, info) => {
        const stream = acceptExec()
        exec(info.command, { cwd: config.directory, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
          if (stdout) stream.write(stdout)
          if (stderr) stream.stderr.write(stderr)
          const code = err && typeof err.code === 'number' ? err.code : (err ? 1 : 0)
          stream.exit(code)
          stream.end()
        })
      })

      session.on('sftp', (acceptSftp) => {
        attachSftp(acceptSftp(), config.directory)
      })
    })
  }

  const start = () => {
    if (server) {
      throw new Error('Server is already running')
    }

    const { private: hostKey } = utils.generateKeyPairSync('ed25519')

    return new Promise((resolve, reject) => {
      server = new Server({ hostKeys: [hostKey] }, (client) => {
        client.on('authentication', (ctx) => {
          if (ctx.method === 'password' &&
            ctx.username === config.username &&
            ctx.password === config.password) {
            ctx.accept()
            return
          }
          ctx.reject(['password'])
        })
        client.on('ready', () => attachSession(client))
        client.on('error', () => {})
      })

      server.once('error', reject)
      server.listen(config.port, config.host, () => {
        server.removeListener('error', reject)
        const url = `ssh://${config.username}:${config.password}@${config.host}:${config.port}`
        const serverInfo = {
          url,
          path: config.directory
        }
        const msg = `${widgetInfo.name} is running at ${url}`
        console.log(msg)
        console.log(`Serving directory (SFTP/shell cwd): ${config.directory}`)
        resolve({ serverInfo, msg, success: true })
      })
    })
  }

  const stop = () => {
    return new Promise((resolve, reject) => {
      for (const term of activePtys) {
        term.kill()
      }
      activePtys.clear()
      if (server) {
        server.close((err) => {
          if (err) return reject(err)
          console.log(`${widgetInfo.name} has been stopped`)
          server = null
          resolve()
        })
      } else {
        console.log(`${widgetInfo.name} is not running`)
        resolve()
      }
    })
  }

  return {
    instanceId,
    start,
    stop
  }
}

module.exports = {
  widgetInfo,
  widgetRun
}
