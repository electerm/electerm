const ftp = require('basic-ftp')
const iconv = require('iconv-lite')

class FtpClientWrapper {
  constructor () {
    this.client = new ftp.Client()
    this.queue = Promise.resolve()
    this.encoding = 'utf-8'
  }

  setEncoding (encoding) {
    this.encoding = encoding || 'utf-8'
    // When using non-UTF-8 encoding, set the FTP control connection to use latin1 (binary)
    // This prevents the library from incorrectly decoding the server's response
    if (this.encoding !== 'utf-8') {
      this.client.ftp.encoding = 'latin1'
    }
  }

  decodeString (str) {
    if (!str) {
      return str
    }
    if (this.encoding === 'utf-8') {
      return str
    }
    try {
      // Convert the latin1 string back to buffer, then decode with target encoding
      const buf = Buffer.from(str, 'latin1')
      return iconv.decode(buf, this.encoding)
    } catch (e) {
      return str
    }
  }

  encodeString (str) {
    if (!str) {
      return str
    }
    if (this.encoding === 'utf-8') {
      return str
    }
    try {
      // Encode with target encoding, then convert to latin1 string for FTP commands
      const buf = iconv.encode(str, this.encoding)
      return buf.toString('latin1')
    } catch (e) {
      return str
    }
  }

  async enqueue (fn) {
    this.queue = this.queue.then(() => fn(), () => fn())
    return this.queue
  }

  set verbose (value) {
    this.client.ftp.verbose = value
  }

  get verbose () {
    return this.client.ftp.verbose
  }

  async access (options) {
    return this.enqueue(async () => {
      if (options.proxy) {
        return this._accessViaProxy(options)
      }
      const { proxy, readyTimeout, ...ftpOptions } = options
      return this.client.access(ftpOptions)
    })
  }

  async _accessViaProxy (options) {
    const proxySock = require('./socks')
    const { FTPError } = require('basic-ftp')
    const proxyResult = await proxySock({
      readyTimeout: options.readyTimeout || 10000,
      host: options.host,
      port: options.port || 21,
      proxy: options.proxy
    })
    const ftpClient = this.client
    ftpClient.ftp.reset()
    ftpClient.ftp.socket = proxyResult.socket
    // Wait for FTP welcome response (mirrors Client._handleConnectResponse)
    const welcome = await ftpClient.ftp.handle(undefined, (res, task) => {
      if (res instanceof Error) {
        task.reject(res)
      } else if (res.code >= 200 && res.code < 300) {
        task.resolve(res)
      } else {
        task.reject(new FTPError(res))
      }
    })
    if (options.secure === true) {
      const secureOptions = { ...(options.secureOptions || {}) }
      secureOptions.host = secureOptions.host || options.host
      await ftpClient.useTLS(secureOptions)
    }
    await ftpClient.sendIgnoringError('OPTS UTF8 ON')
    await ftpClient.login(options.user || 'anonymous', options.password || 'guest')
    await ftpClient.useDefaultSettings()
    return welcome
  }

  async pwd () {
    const result = await this.enqueue(() => this.client.pwd())
    return this.decodeString(result)
  }

  async removeDir (path) {
    const encodedPath = this.encodeString(path)
    return this.enqueue(() => this.client.removeDir(encodedPath))
  }

  async remove (path) {
    const encodedPath = this.encodeString(path)
    return this.enqueue(() => this.client.remove(encodedPath))
  }

  async ensureDir (path) {
    const encodedPath = this.encodeString(path)
    return this.enqueue(() => this.client.ensureDir(encodedPath))
  }

  async list (path) {
    const encodedPath = this.encodeString(path)
    const result = await this.enqueue(() => this.client.list(encodedPath))
    return result.map(item => ({
      ...item,
      name: this.decodeString(item.name)
    }))
  }

  async rename (path, newPath) {
    const encodedPath = this.encodeString(path)
    const encodedNewPath = this.encodeString(newPath)
    return this.enqueue(() => this.client.rename(encodedPath, encodedNewPath))
  }

  async close () {
    return this.enqueue(() => this.client.close())
  }

  async uploadFrom (readable, remotePath) {
    const encodedPath = this.encodeString(remotePath)
    return this.enqueue(() => this.client.uploadFrom(readable, encodedPath))
  }

  async downloadTo (writable, remotePath) {
    const encodedPath = this.encodeString(remotePath)
    return this.enqueue(() => this.client.downloadTo(writable, encodedPath))
  }

  async cd (path) {
    const encodedPath = this.encodeString(path)
    return this.enqueue(() => this.client.cd(encodedPath))
  }

  trackProgress (handler) {
    return this.client.trackProgress(handler)
  }
}

module.exports = FtpClientWrapper
