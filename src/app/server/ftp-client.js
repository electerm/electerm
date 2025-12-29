const ftp = require('basic-ftp')

class FtpClientWrapper {
  constructor () {
    this.client = new ftp.Client()
    this.queue = Promise.resolve()
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
    return this.enqueue(() => this.client.access(options))
  }

  async pwd () {
    return this.enqueue(() => this.client.pwd())
  }

  async removeDir (path) {
    return this.enqueue(() => this.client.removeDir(path))
  }

  async remove (path) {
    return this.enqueue(() => this.client.remove(path))
  }

  async ensureDir (path) {
    return this.enqueue(() => this.client.ensureDir(path))
  }

  async list (path) {
    return this.enqueue(() => this.client.list(path))
  }

  async rename (path, newPath) {
    return this.enqueue(() => this.client.rename(path, newPath))
  }

  async close () {
    return this.enqueue(() => this.client.close())
  }

  async uploadFrom (readable, remotePath) {
    return this.enqueue(() => this.client.uploadFrom(readable, remotePath))
  }

  async downloadTo (writable, remotePath) {
    return this.enqueue(() => this.client.downloadTo(writable, remotePath))
  }

  async cd (path) {
    return this.enqueue(() => this.client.cd(path))
  }

  trackProgress (handler) {
    return this.client.trackProgress(handler)
  }
}

module.exports = FtpClientWrapper
