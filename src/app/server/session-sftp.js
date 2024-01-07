/**
 * terminal/sftp/serial class
 */
const {
  readRemoteFile,
  writeRemoteFile
} = require('./sftp-file')
const { commonExtends } = require('./session-common.js')
const { TerminalBase } = require('./session-base.js')
const { getSizeCount } = require('../common/get-folder-size-and-file-count.js')

class Sftp extends TerminalBase {
  connect (initOptions) {
    return this.remoteInitSftp(initOptions)
  }

  remoteInitSftp (initOptions) {
    this.transfers = {}
    const connInst = global.sessions[initOptions.sessionId]
    const {
      conn
    } = connInst
    this.client = conn
    return new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) {
          reject(err)
        }
        this.sftp = sftp
        connInst.sftps[this.pid] = this
        resolve('ok')
      })
    })
  }

  kill () {
    const keys = Object.keys(this.transfers || {})
    for (const k of keys) {
      const jj = this.transfers[k]
      jj && jj.destroy && jj.destroy()
      delete this.transfers[k]
    }
    this.sftp && this.sftp.end()
    delete this.sftp
    this.onEndConn()
  }

  /**
   * getHomeDir
   *
   * https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md
   * only support linux / mac
   * @return {Promise}
   */
  getHomeDir () {
    return this.runCmd('eval echo "~$different_user"')
  }

  /**
   * rmdir
   *
   * @param {String} remotePath
   * https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md
   * only support rm -rf
   * @return {Promise}
   */
  rmdir (remotePath) {
    return new Promise((resolve, reject) => {
      const { client } = this
      const cmd = `rm -rf "${remotePath}"`
      client.exec(cmd, this.getExecOpts(), err => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  /**
   * touch a file
   *
   * @param {String} remotePath
   * https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md
   * @return {Promise}
   */
  touch (remotePath) {
    return new Promise((resolve, reject) => {
      const { client } = this
      const cmd = `touch "${remotePath}"`
      client.exec(cmd, this.getExecOpts(), err => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  /**
   * cp
   *
   * @param {String} from
   * @param {String} to
   * https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md
   * @return {Promise}
   */
  cp (from, to) {
    return new Promise((resolve, reject) => {
      const { client } = this
      const cmd = `cp -r "${from}" "${to}"`
      client.exec(cmd, this.getExecOpts(), (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  /**
   * mv
   *
   * @param {String} from
   * @param {String} to
   * https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md
   * @return {Promise}
   */
  mv (from, to) {
    return new Promise((resolve, reject) => {
      const { client } = this
      const cmd = `mv "${from}" "${to}"`
      client.exec(cmd, this.getExecOpts(), (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  runExec (cmd) {
    return new Promise((resolve, reject) => {
      const { client } = this
      client.exec(cmd, this.getExecOpts(), (err, stream) => {
        if (err) {
          reject(err)
        } else {
          let out = Buffer.from('')
          stream.on('end', (data) => {
            resolve(out.toString())
          }).on('data', (data) => {
            out = Buffer.concat([out, data])
          }).stderr.on('data', (data) => {
            reject(data.toString())
          })
        }
      })
    })
  }

  getFolderSize (folderPath) {
    return this.runExec(`du -sh "${folderPath}" && find "${folderPath}" -type f | wc -l`)
      .then(getSizeCount)
  }

  /**
   * list remote directory
   *
   * @param {String} remotePath
   * @return {Promise} list
   */
  list (remotePath) {
    return new Promise((resolve, reject) => {
      const { sftp } = this
      const reg = /-/g

      sftp.readdir(remotePath, (err, list) => {
        if (err) {
          return reject(err)
        }
        resolve(list.map(item => {
          const {
            filename,
            longname,
            attrs: {
              size, mtime, atime, uid, gid, mode
            }
          } = item
          // from https://github.com/jyu213/ssh2-sftp-client/blob/master/src/index.js
          return {
            type: longname.substr(0, 1),
            name: filename,
            size,
            modifyTime: mtime * 1000,
            accessTime: atime * 1000,
            mode,
            rights: {
              user: longname.substr(1, 3).replace(reg, ''),
              group: longname.substr(4, 3).replace(reg, ''),
              other: longname.substr(7, 3).replace(reg, '')
            },
            owner: uid,
            group: gid
          }
        }))
      })
    })
  }

  /**
   * mkdir
   *
   * @param {String} remotePath
   * @param {Object} attributes
   * An object with the following valid properties:

      mode - integer - Mode/permissions for the resource.
      uid - integer - User ID of the resource.
      gid - integer - Group ID of the resource.
      size - integer - Resource size in bytes.
      atime - integer - UNIX timestamp of the access time of the resource.
      mtime - integer - UNIX timestamp of the modified time of the resource.

      When supplying an ATTRS object to one of the SFTP methods:
      atime and mtime can be either a Date instance or a UNIX timestamp.
      mode can either be an integer or a string containing an octal number.
   * https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md
   * @return {Promise}
   */
  mkdir (remotePath, options = {}) {
    return new Promise((resolve, reject) => {
      const { sftp } = this
      sftp.mkdir(remotePath, options, err => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  /**
   * stat
   *
   * @param {String} remotePath
   * https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md
   * @return {Promise} stat
   *  stats.isDirectory()
      stats.isFile()
      stats.isBlockDevice()
      stats.isCharacterDevice()
      stats.isSymbolicLink()
      stats.isFIFO()
      stats.isSocket()
   */
  stat (remotePath) {
    return new Promise((resolve, reject) => {
      const { sftp } = this
      sftp.stat(remotePath, (err, stat) => {
        if (err) reject(err)
        else {
          resolve(
            Object.assign(stat, {
              isDirectory: stat.isDirectory()
            })
          )
        }
      })
    })
  }

  /**
   * readlink
   *
   * @param {String} remotePath
   * https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md
   * @return {Promise} target
   */
  readlink (remotePath) {
    return new Promise((resolve, reject) => {
      const { sftp } = this
      sftp.readlink(remotePath, (err, target) => {
        if (err) reject(err)
        else resolve(target)
      })
    })
  }

  /**
   * realpath
   *
   * @param {String} remotePath
   * https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md
   * @return {Promise} target
   */
  realpath (remotePath) {
    return new Promise((resolve, reject) => {
      const { sftp } = this
      sftp.realpath(remotePath, (err, target) => {
        if (err) reject(err)
        else resolve(target)
      })
    })
  }

  /**
   * lstat
   *
   * @param {String} remotePath
   * https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md
   * @return {Promise} stat
   *  stats.isDirectory()
      stats.isFile()
      stats.isBlockDevice()
      stats.isCharacterDevice()
      stats.isSymbolicLink()
      stats.isFIFO()
      stats.isSocket()
   */
  lstat (remotePath) {
    return new Promise((resolve, reject) => {
      const { sftp } = this
      sftp.lstat(remotePath, (err, stat) => {
        if (err) reject(err)
        else resolve(stat)
      })
    })
  }

  /**
   * chmod
   *
   * @param {String} remotePath
   * https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md
   * @return {Promise}
   */
  chmod (remotePath, mode) {
    return new Promise((resolve, reject) => {
      const { sftp } = this
      sftp.chmod(remotePath, mode, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  /**
   * rename
   *
   * @param {String} remotePath
   * @param {String} remotePathNew
   * https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md
   * @return {Promise}
   */
  rename (remotePath, remotePathNew) {
    return new Promise((resolve, reject) => {
      const { sftp } = this
      sftp.rename(remotePath, remotePathNew, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  /**
   * rm delete single file
   *
   * @param {String} remotePath
   * https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md
   * @return {Promise}
   */
  rm (remotePath) {
    return new Promise((resolve, reject) => {
      const { sftp } = this
      sftp.unlink(remotePath, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  /**
   * readFile single file
   *
   * @param {String} remotePath
   * https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md
   * @return {Promise}
   */
  readFile (remotePath) {
    return readRemoteFile(this.sftp, remotePath)
  }

  /**
   * writeFile single file
   *
   * @param {String} remotePath
   * https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md
   * @return {Promise}
   */
  writeFile (remotePath, str, mode) {
    return writeRemoteFile(this.sftp, remotePath, str, mode)
  }
  // end
}

exports.Sftp = commonExtends(Sftp)
