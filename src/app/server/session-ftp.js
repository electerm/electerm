/**
 * terminal/ftp class
 */
const ftp = require('basic-ftp')
const { TerminalBase } = require('./session-base')
const { readRemoteFile, writeRemoteFile } = require('./ftp-file')
const globalState = require('./global-state')
const { Readable } = require('stream')

class Ftp extends TerminalBase {
  constructor (initOptions) {
    super(initOptions)
    this.client = new ftp.Client()
    this.client.ftp.verbose = false
    this.transfers = {}
  }

  async connect () {
    try {
      await this.client.access({
        host: this.initOptions.host,
        port: this.initOptions.port || 21,
        user: this.initOptions.username,
        password: this.initOptions.password,
        secure: this.initOptions.secure
      })

      this.sftp = this.client // For API compatibility
      globalState.ftpSessions = globalState.ftpSessions || {}
      globalState.ftpSessions[this.pid] = this
      return 'ok'
    } catch (err) {
      console.error('FTP connection error:', err)
      throw err
    }
  }

  kill () {
    const keys = Object.keys(this.transfers || {})
    for (const k of keys) {
      const jj = this.transfers[k]
      jj && jj.destroy && jj.destroy()
      delete this.transfers[k]
    }
    this.client && this.client.close()
    delete this.sftp
    if (globalState.ftpSessions && globalState.ftpSessions[this.pid]) {
      delete globalState.ftpSessions[this.pid]
    }
  }

  async getHomeDir () {
    return await this.client.pwd()
  }

  async rmdir (remotePath) {
    await this.client.removeDir(remotePath)
    return 1
  }

  async touch (remotePath) {
    const stream = Readable.from(Buffer.from(''))
    await this.client.uploadFrom(stream, remotePath)
    return 1
  }

  async mkdir (remotePath) {
    await this.client.ensureDir(remotePath)
    return 1
  }

  async stat (remotePath) {
    const list = await this.client.list(remotePath)
    if (!list || !list.length) {
      throw new Error('stat failed')
    }
    const item = list[0]
    return {
      size: item.size,
      accessTime: new Date(item.modifiedAt).getTime(),
      modifyTime: new Date(item.modifiedAt).getTime(),
      mode: 0o777, // Default permissions since FTP doesn't provide this
      isDirectory: () => item.type === 2
    }
  }

  async readlink (remotePath) {
    // FTP doesn't support symlinks directly
    return remotePath
  }

  async realpath (remotePath) {
    const currentPath = await this.client.pwd()
    await this.client.cd(remotePath)
    const realPath = await this.client.pwd()
    await this.client.cd(currentPath)
    return realPath
  }

  async lstat (remotePath) {
    return this.stat(remotePath)
  }

  async chmod (remotePath, mode) {
    // FTP doesn't support chmod
    return 1
  }

  async rename (remotePath, remotePathNew) {
    await this.client.rename(remotePath, remotePathNew)
    return 1
  }

  async rmFolder (remotePath) {
    await this.client.removeDir(remotePath)
    return 1
  }

  async rm (remotePath) {
    await this.client.remove(remotePath)
    return 1
  }

  async list (remotePath) {
    const list = await this.client.list(remotePath)
    return list.map(item => ({
      type: item.type === 2 ? 'd' : '-',
      name: item.name,
      size: item.size,
      modifyTime: new Date(item.modifiedAt).getTime(),
      accessTime: new Date(item.modifiedAt).getTime(),
      mode: 0o777, // Default permissions since FTP doesn't provide this
      rights: {
        user: 'rwx',
        group: 'rwx',
        other: 'rwx'
      },
      owner: 'owner',
      group: 'group'
    }))
  }

  async readFile (remotePath) {
    return readRemoteFile(this.client, remotePath)
  }

  async writeFile (remotePath, str, mode) {
    return writeRemoteFile(this.client, remotePath, str, mode)
  }

  async getFolderSize (folderPath) {
    let size = 0
    let count = 0

    const processDir = async (dirPath) => {
      const list = await this.list(dirPath)
      for (const item of list) {
        if (item.type === 'd') {
          await processDir(`${dirPath}/${item.name}`)
        } else {
          size += item.size
          count++
        }
      }
    }

    await processDir(folderPath)
    return {
      size,
      count
    }
  }
}

exports.Ftp = Ftp
