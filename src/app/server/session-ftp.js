const FtpClientWrapper = require('./ftp-client')
const { TerminalBase } = require('./session-base')
const { commonExtends } = require('./session-common')
const { readRemoteFile, writeRemoteFile } = require('./ftp-file')
const { Readable, PassThrough } = require('stream')
const { posix: path } = require('path')
const globalState = require('./global-state')

class Ftp extends TerminalBase {
  constructor (initOptions) {
    super({
      ...initOptions,
      type: 'ftp' // Explicitly set the type
    })
    this.transfers = {}
  }

  async connect (initOptions) {
    this.initOptions = {
      ...this.initOptions,
      ...initOptions
    }
    this.client = new FtpClientWrapper()
    this.client.verbose = initOptions.debug
    this.client.setEncoding(initOptions.encode || 'utf-8')
    await this.client.access({
      host: initOptions.host,
      port: initOptions.port || 21,
      user: initOptions.user,
      password: initOptions.password,
      secure: initOptions.secure,
      proxy: initOptions.proxy,
      readyTimeout: initOptions.readyTimeout
    })
    globalState.setSession(this.pid, this)
    this.sftp = this.client // For API compatibility
    return 'ok'
  }

  kill () {
    Object.values(this.transfers).forEach(transfer => {
      transfer?.destroy?.()
    })
    this.transfers = {}
    this.client?.close()
    delete this.sftp
    super.onEndConn()
  }

  async getHomeDir () {
    return this.client.pwd()
  }

  async rmdir (remotePath) {
    await this.removeDirectoryRecursively(remotePath)
    return 1
  }

  async mv (from, to) {
    await this.rename(from, to)
    return 1
  }

  async cp (from, to) {
    const sourceStat = await this.stat(from)
    const targetStat = await this.tryStat(to)
    const targetPath = targetStat?.isDirectory
      ? path.join(to, path.basename(from))
      : to
    const sourceClient = await this.createCopyClient()

    try {
      if (sourceStat.isDirectory) {
        await this.copyDirectory(from, targetPath, sourceClient)
      } else {
        await this.copyFile(from, targetPath, sourceClient)
      }
      return 1
    } finally {
      await sourceClient.close().catch(() => {})
    }
  }

  async createCopyClient () {
    const client = new FtpClientWrapper()
    const {
      debug,
      encode,
      host,
      password,
      port,
      proxy,
      readyTimeout,
      secure,
      user
    } = this.initOptions

    client.verbose = debug
    client.setEncoding(encode || 'utf-8')
    await client.access({
      host,
      port: port || 21,
      user,
      password,
      secure,
      proxy,
      readyTimeout
    })
    return client
  }

  async tryStat (remotePath) {
    try {
      return await this.stat(remotePath)
    } catch (error) {
      return null
    }
  }

  async ensureDirSafe (remotePath) {
    const currentPath = await this.client.pwd()
    try {
      await this.client.ensureDir(remotePath)
    } finally {
      if (currentPath) {
        await this.client.cd(currentPath).catch(() => {})
      }
    }
  }

  async copyDirectory (sourcePath, targetPath, sourceClient) {
    await this.ensureDirSafe(targetPath)
    const list = await this.list(sourcePath)
    for (const item of list) {
      const nextSourcePath = path.join(sourcePath, item.name)
      const nextTargetPath = path.join(targetPath, item.name)
      if (item.type === 'd') {
        await this.copyDirectory(nextSourcePath, nextTargetPath, sourceClient)
      } else {
        await this.copyFile(nextSourcePath, nextTargetPath, sourceClient)
      }
    }
  }

  async copyFile (sourcePath, targetPath, sourceClient) {
    const transferStream = new PassThrough()
    const downloadPromise = sourceClient.downloadTo(transferStream, sourcePath)
      .catch(error => {
        transferStream.destroy(error)
        throw error
      })
    const uploadPromise = this.client.uploadFrom(transferStream, targetPath)
      .catch(error => {
        transferStream.destroy(error)
        throw error
      })

    await Promise.all([downloadPromise, uploadPromise])
  }

  async removeDirectoryRecursively (remotePath) {
    const contents = await this.list(remotePath)
    for (const item of contents) {
      const itemPath = `${remotePath}/${item.name}`
      if (item.type === 'd') {
        await this.removeDirectoryRecursively(itemPath)
      } else {
        await this.rm(itemPath)
      }
    }
    await this.rmFolder(remotePath)
  }

  async touch (remotePath) {
    const emptyStream = new Readable({
      read () {
        this.push(null)
      }
    })
    await this.client.uploadFrom(emptyStream, remotePath)
    return 1
  }

  async mkdir (remotePath) {
    await this.client.ensureDir(remotePath)
    return 1
  }

  async stat (remotePath) {
    const pathParts = remotePath.split('/')
    const fileName = pathParts.pop()
    const parentPath = pathParts.join('/') || '/'
    const list = await this.client.list(parentPath)
    if (!list || !list.length) {
      throw new Error('stat failed: parent directory listing empty')
    }

    const item = list.find(item => item.name === fileName)
    if (!item) {
      throw new Error(`stat failed: ${fileName} not found in ${parentPath}`)
    }
    return {
      size: item.size,
      accessTime: new Date(item.modifiedAt).getTime(),
      modifyTime: new Date(item.modifiedAt).getTime(),
      mode: 0o777, // Default permissions since FTP doesn't provide this
      isDirectory: item.type === 2
    }
  }

  async readlink (remotePath) {
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

  async chmod () {
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
    return list.map(item => {
      const dt = new Date(item.rawModifiedAt).getTime()
      return {
        type: item.type === 2 ? 'd' : '-',
        name: item.name,
        size: item.size,
        modifyTime: dt,
        accessTime: dt,
        mode: 0o777, // Default permissions since FTP doesn't provide this
        rights: {
          user: 'rwx',
          group: 'rwx',
          other: 'rwx'
        },
        owner: 'owner',
        group: 'group'
      }
    })
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
    return { size, count }
  }
}

exports.Ftp = commonExtends(Ftp)
