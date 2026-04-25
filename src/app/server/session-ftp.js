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

  getClientAccessOptions (initOptions = this.initOptions) {
    return {
      host: initOptions.host,
      port: initOptions.port || 21,
      user: initOptions.user,
      password: initOptions.password,
      secure: initOptions.secure,
      proxy: initOptions.proxy,
      readyTimeout: initOptions.readyTimeout
    }
  }

  async createConnectedClient (initOptions = this.initOptions) {
    const client = new FtpClientWrapper()
    client.verbose = initOptions.debug
    client.setEncoding(initOptions.encode || 'utf-8')
    await client.access(this.getClientAccessOptions(initOptions))
    return client
  }

  async createOperationClient () {
    return this.createConnectedClient()
  }

  async withOperationClient (handler, client) {
    if (client) {
      return handler(client)
    }
    const operationClient = await this.createOperationClient()
    try {
      return await handler(operationClient)
    } finally {
      await operationClient.close().catch(() => {})
    }
  }

  async connect (initOptions) {
    this.initOptions = {
      ...this.initOptions,
      ...initOptions
    }
    const client = await this.createConnectedClient(this.initOptions)
    await client.close().catch(() => {})
    globalState.setSession(this.pid, this)
    return 'ok'
  }

  kill () {
    Object.values(this.transfers).forEach(transfer => {
      transfer?.destroy?.()
    })
    this.transfers = {}
    super.onEndConn()
  }

  async getHomeDir () {
    return this.withOperationClient(client => client.pwd())
  }

  async rmdir (remotePath) {
    await this.withOperationClient(client => {
      return this.removeDirectoryRecursively(remotePath, client)
    })
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
    const sourceClient = await this.createOperationClient()
    const targetClient = await this.createOperationClient()

    try {
      if (sourceStat.isDirectory) {
        await this.copyDirectory(from, targetPath, sourceClient, targetClient)
      } else {
        await this.copyFile(from, targetPath, sourceClient, targetClient)
      }
      return 1
    } finally {
      await sourceClient.close().catch(() => {})
      await targetClient.close().catch(() => {})
    }
  }

  async tryStat (remotePath, client) {
    try {
      return await this.stat(remotePath, client)
    } catch (error) {
      return null
    }
  }

  async ensureDirSafe (remotePath, client) {
    const currentPath = await client.pwd()
    try {
      await client.ensureDir(remotePath)
    } finally {
      if (currentPath) {
        await client.cd(currentPath).catch(() => {})
      }
    }
  }

  async copyDirectory (sourcePath, targetPath, sourceClient, targetClient) {
    await this.ensureDirSafe(targetPath, targetClient)
    const list = await this.list(sourcePath, sourceClient)
    for (const item of list) {
      const nextSourcePath = path.join(sourcePath, item.name)
      const nextTargetPath = path.join(targetPath, item.name)
      if (item.type === 'd') {
        await this.copyDirectory(nextSourcePath, nextTargetPath, sourceClient, targetClient)
      } else {
        await this.copyFile(nextSourcePath, nextTargetPath, sourceClient, targetClient)
      }
    }
  }

  async copyFile (sourcePath, targetPath, sourceClient, targetClient) {
    const transferStream = new PassThrough()
    const downloadPromise = sourceClient.downloadTo(transferStream, sourcePath)
      .catch(error => {
        transferStream.destroy(error)
        throw error
      })
    const uploadPromise = targetClient.uploadFrom(transferStream, targetPath)
      .catch(error => {
        transferStream.destroy(error)
        throw error
      })

    await Promise.all([downloadPromise, uploadPromise])
  }

  async removeDirectoryRecursively (remotePath, client) {
    const contents = await this.list(remotePath, client)
    for (const item of contents) {
      const itemPath = `${remotePath}/${item.name}`
      if (item.type === 'd') {
        await this.removeDirectoryRecursively(itemPath, client)
      } else {
        await this.rm(itemPath, client)
      }
    }
    await this.rmFolder(remotePath, client)
  }

  async touch (remotePath) {
    const emptyStream = new Readable({
      read () {
        this.push(null)
      }
    })
    await this.withOperationClient(client => client.uploadFrom(emptyStream, remotePath))
    return 1
  }

  async mkdir (remotePath) {
    await this.withOperationClient(client => client.ensureDir(remotePath))
    return 1
  }

  async stat (remotePath, client) {
    return this.withOperationClient(async currentClient => {
      const pathParts = remotePath.split('/')
      const fileName = pathParts.pop()
      const parentPath = pathParts.join('/') || '/'
      const list = await currentClient.list(parentPath)
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
    }, client)
  }

  async readlink (remotePath) {
    return remotePath
  }

  async realpath (remotePath, client) {
    return this.withOperationClient(async currentClient => {
      const currentPath = await currentClient.pwd()
      await currentClient.cd(remotePath)
      const realPath = await currentClient.pwd()
      await currentClient.cd(currentPath)
      return realPath
    }, client)
  }

  async lstat (remotePath, client) {
    return this.stat(remotePath, client)
  }

  async chmod () {
    // FTP doesn't support chmod
    return 1
  }

  async rename (remotePath, remotePathNew) {
    await this.withOperationClient(client => client.rename(remotePath, remotePathNew))
    return 1
  }

  async rmFolder (remotePath, client) {
    await this.withOperationClient(currentClient => currentClient.removeDir(remotePath), client)
    return 1
  }

  async rm (remotePath, client) {
    await this.withOperationClient(currentClient => currentClient.remove(remotePath), client)
    return 1
  }

  async list (remotePath, client) {
    return this.withOperationClient(async currentClient => {
      const list = await currentClient.list(remotePath)
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
    }, client)
  }

  async readFile (remotePath, client) {
    return this.withOperationClient(currentClient => readRemoteFile(currentClient, remotePath), client)
  }

  async writeFile (remotePath, str, mode, client) {
    return this.withOperationClient(currentClient => {
      return writeRemoteFile(currentClient, remotePath, str, mode)
    }, client)
  }

  async getFolderSize (folderPath, client) {
    let size = 0
    let count = 0
    const processDir = async (dirPath) => {
      const list = await this.list(dirPath, client)
      for (const item of list) {
        if (item.type === 'd') {
          await processDir(`${dirPath}/${item.name}`)
        } else {
          size += item.size
          count++
        }
      }
    }
    return this.withOperationClient(async currentClient => {
      client = currentClient
      await processDir(folderPath)
      return { size, count }
    }, client)
  }
}

exports.Ftp = commonExtends(Ftp)
