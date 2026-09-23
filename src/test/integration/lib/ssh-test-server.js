/**
 * In-process SSH test server for MCP integration tests.
 *
 * Built on @electerm/ssh2 (the same fork the app uses client-side).
 * Supports exactly what the MCP integration suite needs:
 *   - password auth (fixed test credentials, localhost only)
 *   - exec channels (runs commands locally, real stdout/stderr/exit code)
 *   - interactive shell (minimal line-based REPL for terminal tabs)
 *   - SFTP subsystem confined to a per-run temp directory
 *
 * The host key is a FIXED test-only keypair (embedded below) so the
 * matching known_hosts entry only has to be seeded once — see
 * ensureKnownHostsEntry(). The key never protects anything real; the
 * server binds 127.0.0.1 and accepts only the test credentials.
 */

const { Server, utils } = require('@electerm/ssh2')
const { exec } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const HOST_KEY_PRIVATE = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtz
c2gtZWQyNTUxOQAAACCc59cLQEg1OyMh/Xpa34fddyOnThmVs/hl29O9yei94AAA
AIgOH8OaDh/DmgAAAAtzc2gtZWQyNTUxOQAAACCc59cLQEg1OyMh/Xpa34fddyOn
ThmVs/hl29O9yei94AAAAEAAsISojztaEkZhrWYF2Wkia86zAZNuv5gSI8u7w2DL
Dpzn1wtASDU7IyH9elrfh913I6dOGZWz+GXb073J6L3gAAAAAAECAwQF
-----END OPENSSH PRIVATE KEY-----
`

const HOST_KEY_PUBLIC = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJzn1wtASDU7IyH9elrfh913I6dOGZWz+GXb073J6L3g'

const TEST_USERNAME = 'mcpit'
const TEST_PASSWORD = 'mcpit-pass'
const TEST_PORT = 22022

// electerm verifies host keys against ~/.ssh/known_hosts and asks the user
// (UI prompt) on unknown hosts — a prompt would hang an automated test run.
// Seed the fixed test entry once; it stays valid across runs because both
// the host key and the port are fixed.
function ensureKnownHostsEntry (port = TEST_PORT, log = () => {}) {
  const knownHostsPath = path.join(os.homedir(), '.ssh', 'known_hosts')
  const entry = `[127.0.0.1]:${port} ${HOST_KEY_PUBLIC}`
  let content = ''
  try {
    content = fs.readFileSync(knownHostsPath, 'utf8')
  } catch (e) {
    if (e.code !== 'ENOENT') throw e
  }
  if (content.includes(HOST_KEY_PUBLIC)) {
    return false
  }
  fs.mkdirSync(path.dirname(knownHostsPath), { recursive: true, mode: 0o700 })
  const prefix = content && !content.endsWith('\n') ? '\n' : ''
  fs.appendFileSync(knownHostsPath, `${prefix}${entry}\n`, { mode: 0o600 })
  log(`seeded known_hosts entry for [127.0.0.1]:${port}`)
  return true
}

// Run a command locally and pipe the result through an SSH exec channel,
// mirroring what a real sshd does (stdout, stderr, exit status).
//
// The remote-monitor specs (0061/0062) treat this fixture as a Linux host
// and probe /proc/stat, /proc/meminfo, /sys/class/net etc. Those paths do
// not exist on macOS (the CI runner OS), where the fixture actually runs,
// so every monitor group would end up "unsupported" and cpuHistory would
// never fill. Intercept the known monitor commands and answer with small
// deterministic Linux-style outputs instead of executing them locally.
const emulatorState = {
  cpu: { user: 1200, nice: 0, system: 800, idle: 950000, iowait: 100, irq: 0, softirq: 50, last: 0 },
  net: { rx: 8000000, tx: 4000000, last: 0 }
}

function fakeCpuLine (minElapsedMs) {
  const state = emulatorState.cpu
  const now = Date.now()
  const real = Math.max(0, now - state.last)
  const elapsed = Math.max(real, minElapsedMs || 0)
  state.last = now
  // ~2 jiffies per ms, ~92% idle so usage stays in the "normal" band
  const ticks = Math.round(elapsed * 2) || 20
  const idleTicks = Math.round(ticks * 0.92)
  const busy = ticks - idleTicks
  const userTicks = Math.round(busy * 0.6)
  const systemTicks = Math.round(busy * 0.3)
  state.user += userTicks
  state.system += systemTicks
  state.iowait += busy - userTicks - systemTicks
  state.idle += idleTicks
  return `cpu  ${state.user} ${state.nice} ${state.system} ${state.idle} ${state.iowait} ${state.irq} ${state.softirq} 0 0 0`
}

function fakeNetSample () {
  const state = emulatorState.net
  const now = Date.now()
  const elapsed = state.last ? Math.max(0, now - state.last) : 1000
  state.last = now
  state.rx += elapsed * 120
  state.tx += elapsed * 60
  return [
    'default\teth0',
    `iface\teth0\tstate=up\tipv4=10.0.0.2/24\trx=${Math.round(state.rx)}\ttx=${Math.round(state.tx)}`
  ].join('\n') + '\n'
}

function emulateMonitorCommand (command) {
  if (command.includes('/proc/stat')) {
    // two samples with a guaranteed gap, like `sleep 0.1` between greps
    const first = fakeCpuLine()
    const second = fakeCpuLine(200)
    return `${first}\n${second}\n`
  }
  if (command.includes('/proc/meminfo')) {
    return [
      'MemTotal:       16000000 kB',
      'MemFree:         8000000 kB',
      'MemAvailable:   10000000 kB',
      'Buffers:          200000 kB',
      'Cached:          1500000 kB',
      'SwapTotal:       2000000 kB',
      'SwapFree:        1800000 kB'
    ].join('\n') + '\n'
  }
  if (command.includes('/proc/uptime')) {
    return `${os.uptime().toFixed(2)} 0.35\n`
  }
  if (command.includes('/sys/class/net')) {
    return fakeNetSample()
  }
  if (command.includes('ps -eo')) {
    return [
      '    1 root      0.0   4096 /sbin/init',
      '  483 root      1.2  20480 /usr/sbin/sshd -D',
      '  917 mcpit     0.4  12288 bash'
    ].join('\n') + '\n'
  }
  if (/^uname\s/.test(command.trim())) {
    return 'Linux electerm-fixture 5.15.0-generic x86_64\n'
  }
  if (command.trim() === 'who') {
    return 'mcpit  pts/0  2026-09-11 08:00 (10.0.0.9)\n'
  }
  return null
}

function attachExec (stream, command) {
  const emulated = emulateMonitorCommand(String(command || ''))
  if (emulated !== null) {
    stream.write(emulated)
    stream.exit(0)
    stream.end()
    return
  }
  exec(command, { maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
    if (stdout) stream.write(stdout)
    if (stderr && stream.stderr) stream.stderr.write(stderr)
    const code = err && typeof err.code === 'number' ? err.code : 0
    stream.exit(code)
    stream.end()
  })
}

// Minimal line-based shell so terminal tabs get a usable PTY.
function attachShell (stream) {
  let buf = ''
  const prompt = () => stream.write('\n$ ')
  stream.write('Welcome to the electerm MCP integration test shell')
  prompt()
  stream.on('data', (data) => {
    const s = data.toString()
    for (const ch of s) {
      if (ch === '\r' || ch === '\n') {
        const line = buf
        buf = ''
        stream.write('\r\n')
        if (line.trim()) {
          exec(line, { maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
            if (stdout) stream.write(stdout.replace(/\n/g, '\r\n'))
            if (stderr) stream.write(stderr.replace(/\n/g, '\r\n'))
            if (err && !stdout && !stderr) {
              stream.write(`sh: ${line}: command failed\r\n`)
            }
            prompt()
          })
        } else {
          prompt()
        }
      } else if (ch === '\x03') {
        buf = ''
        prompt()
      } else if (ch === '\x7f') {
        buf = buf.slice(0, -1)
      } else {
        buf += ch
        stream.write(ch) // echo
      }
    }
  })
}

// SFTP subsystem confined to rootDir. Implements just enough of the
// protocol for the MCP sftp tools: REALPATH, STAT/LSTAT, OPENDIR/READDIR,
// OPEN/READ/WRITE/CLOSE, REMOVE, MKDIR.
function attachSftp (sftp, rootDir) {
  const { STATUS_CODE } = utils.sftp
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

  const modeFileType = (mode) => {
    const t = mode & 0o170000
    return t === 0o040000 ? 'd' : t === 0o120000 ? 'l' : '-'
  }

  const modeToPermStr = (mode) => {
    const part = (r, w, x) =>
      (mode & r ? 'r' : '-') + (mode & w ? 'w' : '-') + (mode & x ? 'x' : '-')
    return modeFileType(mode) +
      part(0o400, 0o200, 0o100) +
      part(0o040, 0o020, 0o010) +
      part(0o004, 0o002, 0o001)
  }

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  // ls-style longname: drwxr-xr-x 1 uid gid size mtime name
  const toLongname = (name, st) => {
    const d = new Date(st.mtimeMs)
    const time = `${months[d.getMonth()]} ${String(d.getDate()).padStart(2)}` +
      ` ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    return `${modeToPermStr(st.mode)}  1 ${st.uid} ${st.gid} ${st.size} ${time} ${name}`
  }

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
      openDirs.set(handle.toString(), { entries, dirPath: confine(p), sent: false })
      sftp.handle(reqID, handle)
    })
  })

  sftp.on('READDIR', (reqID, handle) => {
    const dir = openDirs.get(handle.toString())
    if (!dir) return sftp.status(reqID, STATUS_CODE.FAILURE)
    if (dir.sent) return sftp.status(reqID, STATUS_CODE.EOF)
    dir.sent = true
    Promise.all(dir.entries.map(e => {
      return new Promise(resolve => {
        fs.lstat(path.join(dir.dirPath, e.name), (err, st) => {
          if (err) {
            return resolve({
              filename: e.name,
              longname: e.name,
              attrs: {}
            })
          }
          resolve({
            filename: e.name,
            longname: toLongname(e.name, st),
            attrs: toAttrs(st)
          })
        })
      })
    }))
      .then(names => sftp.name(reqID, names))
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

function startTestSshServer ({ port = TEST_PORT, rootDir } = {}) {
  const clients = new Set()
  const server = new Server({ hostKeys: [HOST_KEY_PRIVATE] }, (client) => {
    clients.add(client)
    client.on('close', () => clients.delete(client))
    client.on('authentication', (ctx) => {
      if (ctx.method === 'password' &&
        ctx.username === TEST_USERNAME &&
        ctx.password === TEST_PASSWORD) {
        ctx.accept()
        return
      }
      ctx.reject(['password'])
    })
    client.on('ready', () => {
      client.on('session', (accept) => {
        const session = accept()
        session.on('pty', (acceptPty) => {
          if (acceptPty) acceptPty()
        })
        session.on('shell', (acceptShell) => {
          attachShell(acceptShell())
        })
        session.on('exec', (acceptExec, reject, info) => {
          attachExec(acceptExec(), info.command)
        })
        session.on('sftp', (acceptSftp) => {
          attachSftp(acceptSftp(), rootDir)
        })
      })
    })
    client.on('error', () => {})
  })
  // expose tracked clients so stopTestSshServer can end live connections
  server._clients = clients
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', reject)
      resolve(server)
    })
  })
}

// Stop the test server, ending live client connections first.
// Server.close() waits for existing connections to end — without ending
// them the callback never fires and callers hang. The timeout is a safety
// net so a lingering socket can never hang the suite.
function stopTestSshServer (server) {
  return new Promise(resolve => {
    let done = false
    const finish = () => {
      if (!done) {
        done = true
        resolve()
      }
    }
    const timer = setTimeout(finish, 5000)
    try {
      for (const client of server._clients || []) {
        try {
          client.end()
        } catch (_) {
          // already gone
        }
      }
    } catch (_) {
      // best effort — fall through to close()
    }
    server.close(() => {
      clearTimeout(timer)
      finish()
    })
  })
}

module.exports = {
  startTestSshServer,
  stopTestSshServer,
  ensureKnownHostsEntry,
  HOST_KEY_PUBLIC,
  TEST_USERNAME,
  TEST_PASSWORD,
  TEST_PORT
}
