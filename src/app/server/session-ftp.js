/**
 * terminal/ftp class
 */
const ftp = require('basic-ftp')
const { TerminalBase } = require('./session-base')
const { commonExtends } = require('./session-common')
const fs = require('original-fs')
const log = require('../common/log')
const { readRemoteFile, writeRemoteFile } = require('./ftp-file')
const { getSizeCount } = require('../common/get-folder-size-and-file-count')
const globalState = require('./global-state')

class Ftp extends TerminalBase {
  async connect(initOptions) {
    this.transfers = {}
    const connInst = globalState.getSession(initOptions.sessionId)
    
    this.client = new ftp.Client()
    this.client.ftp.verbose = false
    
    try {
      await this.client.access({
        host: initOptions.host,
        port: initOptions.port || 21,
        user: initOptions.username,
        password: initOptions.password,
        secure: initOptions.secure
      })
      
      this.sftp = this.client // For API compatibility
      connInst.sftps[this.pid] = this
      return 'ok'
    } catch (err) {
      throw err
    }
  }

  kill() {
    const keys = Object.keys(this.transfers || {})
    for (const k of keys) {
      const jj = this.transfers[k]
      jj && jj.destroy && jj.destroy()
      delete this.transfers[k]
    }
    this.client && this.client.close()
    delete this.sftp
    this.onEndConn()
  }

  async getHomeDir() {
    try {
      return await this.client.pwd()
    } catch (err) {
      throw err
    }
  }

  async rmdir(remotePath) {
    try {
      await this.rmrf(remotePath)
      return 1
    } catch (err) {
      console.error('rm -rf dir error', err)
      return this.removeDirectoryRecursively(remotePath)
    }
  }

  async rmrf(remotePath) {
    try {
      await this.client.removeDir(remotePath)
      return 1
    } catch (err) {
      throw err
    }
  }

  async removeDirectoryRecursively(remotePath) {
    try {
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
      return 1
    } catch (err) {
      throw err
    }
  }

  async touch(remotePath) {
    try {
      const buffer = Buffer.from('')
      await this.client.uploadFrom(buffer, remotePath)
      return 1
    } catch (err) {
      throw err
    }
  }

  async mkdir(remotePath, options = {}) {
    try {
      await this.client.ensureDir(remotePath)
      return 1
    } catch (err) {
      throw err
    }
  }

  async stat(remotePath) {
    try {
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
    } catch (err) {
      throw err
    }
  }

  async readlink(remotePath) {
    // FTP doesn't support symlinks directly
    return remotePath
  }

  async realpath(remotePath) {
    try {
      const currentPath = await this.client.pwd()
      await this.client.cd(remotePath)
      const realPath = await this.client.pwd()
      await this.client.cd(currentPath)
      return realPath
    } catch (err) {
      throw err
    }
  }

  async lstat(remotePath) {
    return this.stat(remotePath)
  }

  async chmod(remotePath, mode) {
    // FTP doesn't support chmod
    return 1
  }

  async rename(remotePath, remotePathNew) {
    try {
      await this.client.rename(remotePath, remotePathNew)
      return 1
    } catch (err) {
      throw err
    }
  }

  async rmFolder(remotePath) {
    try {
      await this.client.removeDir(remotePath)
      return 1
    } catch (err) {
      throw err
    }
  }

  async rm(remotePath) {
    try {
      await this.client.remove(remotePath)
      return 1
    } catch (err) {
      throw err
    }
  }

  async list(remotePath) {
    try {
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
    } catch (err) {
      throw err
    }
  }

  async readFile(remotePath) {
    return readRemoteFile(this.client, remotePath)
  }

  async writeFile(remotePath, str, mode) {
    return writeRemoteFile(this.client, remotePath, str, mode)
  }

  async getFolderSize(folderPath) {
    try {
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
        size: size,
        count: count
      }
    } catch (err) {
      throw err
    }
  }
}

exports.Ftp = commonExtends(Ftp)