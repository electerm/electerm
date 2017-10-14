/**
 * ssh2 sftp client
 */

let {Client} = require('ssh2')
let _ = require('lodash')

class Sftp {

  constructor() {
    this.client = new Client()
  }

  /**
   * connect to server
   * @return {Promise} sftp inst
   */
  connect() {
    let {client} = this
    return new Promise((resolve, reject) => {
        this.client.on('ready', () => {
          this.client.sftp((err, sftp) => {
            if (err) {
              reject(err)
            }
            this.sftp = sftp
            resolve(sftp)
          })
        }).on('error', (err) => {
          reject(err)
        }).connect(config)
    })
  }

  /**
   * end connection
   */
  end () {
    this.client.end()
  }

  /**
   * list remote directory
   *
   * @param {String} remotePath
   * @return {Promise} list
   */
  list (remotePath) {
    return new Promise((resolve, reject) => {
      let {sftp} = this
      let reg = /-/g

      sftp.readdir(path, (err, list) => {
        if (err) {
          return reject(err)
        }
        resolve(list.map(item => {
          let {
            filename,
            longname,
            attrs: {
              size, mtime, atime, uid, gid
            }
          } = item
          //from https://github.com/jyu213/ssh2-sftp-client/blob/master/src/index.js
          return {
            type: longname.substr(0, 1),
            name: filename,
            size,
            modifyTime: mtime * 1000,
            accessTime: atime * 1000,
            rights: {
                user: longname.substr(1, 3).replace(reg, ''),
                group: longname.substr(4,3).replace(reg, ''),
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
   * download remote file
   *
   * @param {String} remotePath
   * @param {String} localPath
   * @param {Object} options
   * https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md
   * options.concurrency - integer - Number of concurrent reads Default: 64
   * options.chunkSize - integer - Size of each read in bytes Default: 32768
   * @param {Function} onData function(< integer >total_transferred, < integer >chunk, < integer >total) - Called every time a part of a file was transferred
   * @return {Promise}
   */
  download (remotePath, localPath, options = {}, onData = _.noop) {
    return new Promise((resolve, reject) => {
      let {sftp} = this
      let opts = Object({}, options, {
        step: (total_transferred, chunk, total) => {
          onData(total_transferred, chunk, total)
          if (total_transferred >= total) {
            resolve()
          }
        }
      })
      sftp.fastGet(remotePath, localPath, options, err => {
        reject(err)
      })
    })
  }

  /**
   * upload file
   *
   * @param {String} remotePath
   * @param {String} localPath
   * @param {Object} options
   * https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md
   * options.concurrency - integer - Number of concurrent reads Default: 64
   * options.chunkSize - integer - Size of each read in bytes Default: 32768
   * options.mode - mixed - Integer or string representing the file mode to set for the uploaded file.
   * @param {Function} onData function(< integer >total_transferred, < integer >chunk, < integer >total) - Called every time a part of a file was transferred
   * @return {Promise}
   */
  upload (remotePath, localPath, options = {}, onData = _.noop) {
    return new Promise((resolve, reject) => {
      let {sftp} = this
      let opts = Object({}, options, {
        step: (total_transferred, chunk, total) => {
          onData(total_transferred, chunk, total)
        }
      })
      sftp.fastPut(remotePath, localPath, options, err => {
        if (err) reject(err)
        else resolve()
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
      let {sftp} = this
      sftp.mkdir(remotePath, options, err => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  /**
   * rmdir
   *
   * @param {String} remotePath
   * https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md
   * @return {Promise}
   */
  rmdir (remotePath) {
    return new Promise((resolve, reject) => {
      let {sftp} = this
      sftp.rmdir(remotePath, err => {
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
      let {sftp} = this
      sftp.stat(remotePath, (err, stat) => {
        if (err) reject(err)
        else resolve(stat)
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
      let {sftp} = this
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
   * @return {Promise} stat
   *  stats.isDirectory()
      stats.isFile()
      stats.isBlockDevice()
      stats.isCharacterDevice()
      stats.isSymbolicLink()
      stats.isFIFO()
      stats.isSocket()
   */
  chmod (remotePath) {
    return new Promise((resolve, reject) => {
      let {sftp} = this
      sftp.chmod(remotePath, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  /**
   * mv
   *
   * @param {String} remotePath
   * @param {String} remotePathNew
   * https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md
   * @return {Promise}
   */
  mv (remotePath, remotePathNew) {
    return new Promise((resolve, reject) => {
      let {sftp} = this
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
  rm (remotePath, remotePathNew) {
    return new Promise((resolve, reject) => {
      let {sftp} = this
      sftp.rm(remotePath, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  //end
}


module.exports = Sftp
