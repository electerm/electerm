/**
 * ssh2 sftp client
 */

let {Client} = require('ssh2')
const proxySock = require('./socks')
const _ = require('lodash')
const {readRemoteFile, writeRemoteFile} = require('./sftp-file')

class Sftp {

  constructor() {
    this.client = new Client()
  }

  /**
   * connect to server
   * @return {Promise} sftp inst
   */
  connect(config) {
    let {client} = this
    let confs = Object.assign(
      {
        tryKeyboard: true
      },
      {
        readyTimeout: _.get(config, 'sshReadyTimeout'),
        keepaliveInterval: _.get(config, 'keepaliveInterval'),
        agent: process.env.SSH_AUTH_SOCK
      },
      config
    )
    if (!confs.password) {
      delete confs.password
    }
    if (!confs.passphrase) {
      delete confs.passphrase
    }
    return new Promise((resolve, reject) => {
      const run = (info) => {
        if (info && info.socket) {
          delete confs.host
          delete confs.port
          delete confs.proxy
          confs.sock = info.socket
        }
        client
          .on('keyboard-interactive', (
            name,
            instructions,
            instructionsLang,
            prompts,
            finish
          ) => {
            finish([confs.password])
          })
          .on('ready', () => {
            client.sftp((err, sftp) => {
              if (err) {
                reject(err)
              }
              this.sftp = sftp
              resolve('')
            })
          })
          .on('error', (err) => {
            reject(err)
          })
          .connect(confs)
      }
      if (
        config.proxy &&
        config.proxy.proxyIp &&
        config.proxy.proxyPort
      ) {
        proxySock({
          ...config,
          ...confs
        }).then(run)
      } else {
        run()
      }
    })
  }

  // /**
  //  * connect to socks5 proxy
  //  */
  // proxy(config) {
  //   const socks = socksv5.connect({
  //     host: options.host,
  //     port: options.port,
  //     proxyHost: options.proxyHost,
  //     proxyPort: options.proxyPort,
  //     auths: options.auths || [ socksv5.auth.None() ]
  //   }, (socket) => {
  //     let sshOptions = Object.assign({
  //       sock: socket
  //     }, options)
  //     delete sshOptions.host
  //     delete sshOptions.port
  //     delete sshOptions.proxyHost
  //     delete sshOptions.proxyPort
  //     return super.connect(sshOptions)
  //   });
  //   socks.on('error', (error) => {
  //     error.level = 'socks'
  //     this.emit('error', error)
  //   })
  // }

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

      sftp.readdir(remotePath, (err, list) => {
        if (err) {
          return reject(err)
        }
        resolve(list.map(item => {
          let {
            filename,
            longname,
            attrs: {
              size, mtime, atime, uid, gid, mode
            }
          } = item
          //from https://github.com/jyu213/ssh2-sftp-client/blob/master/src/index.js
          return {
            type: longname.substr(0, 1),
            name: filename,
            size,
            modifyTime: mtime * 1000,
            accessTime: atime * 1000,
            mode,
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
   * getHomeDir
   *
   * https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md
   * only support linux / mac
   * @return {Promise}
   */
  getHomeDir () {
    return new Promise((resolve, reject) => {
      let {client} = this
      let cmd = 'eval echo "~$different_user"'
      client.exec(cmd, (err, stream) => {
        if (err) reject(err)
        stream.on('data', function(data) {
          resolve(data.toString())
        })
      })
    })
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
      let {client} = this
      let cmd = `rm -rf "${remotePath}"`
      client.exec(cmd, err => {
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
        else resolve(
          Object.assign(stat, {
            isDirectory: stat.isDirectory()
          })
        )
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
      let {sftp} = this
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
      let {sftp} = this
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
   * @return {Promise}
   */
  chmod (remotePath, mode) {
    return new Promise((resolve, reject) => {
      let {sftp} = this
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
  rm (remotePath) {
    return new Promise((resolve, reject) => {
      let {sftp} = this
      sftp.unlink(remotePath, (err) => {
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
      let {client} = this
      let cmd = `touch "${remotePath}"`
      client.exec(cmd, err => {
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
      let {client} = this
      let cmd = `mv "${from}" "${to}"`
      client.exec(cmd, (err) => {
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
      let {client} = this
      let cmd = `cp -r "${from}" "${to}"`
      client.exec(cmd, (err) => {
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
  //end
}

module.exports = {
  Sftp,
  instSftpKeys: [
    'connect',
    'list',
    'download',
    'upload',
    'mkdir',
    'getHomeDir',
    'rmdir',
    'stat',
    'lstat',
    'chmod',
    'rename',
    'rm',
    'touch',
    'readlink',
    'realpath',
    'mv',
    'cp',
    'readFile',
    'writeFile'
  ]
}
