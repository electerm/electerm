/**
 * ftp-file.js
 * Functions for reading and writing files via FTP
 */

const fs = require('fs').promises;
const path = require('path');
const { Readable } = require('stream');

/**
 * Read a remote file via FTP
 * @param {Object} client - FTP client instance
 * @param {String} remotePath - Path of the file on the remote server
 * @returns {Promise<Buffer>} - File content as a Buffer
 */
exports.readRemoteFile = async (client, remotePath) => {
  return new Promise((resolve, reject) => {
    let data = Buffer.from('');
    client.downloadTo(data, remotePath, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
};

/**
 * Write content to a remote file via FTP
 * @param {Object} client - FTP client instance
 * @param {String} remotePath - Path of the file on the remote server
 * @param {String|Buffer} str - Content to write to the file
 * @param {Number} [mode=0o644] - File permissions
 * @returns {Promise<void>}
 */
exports.writeRemoteFile = async (client, remotePath, str, mode = 0o644) => {
  const content = typeof str === 'string' ? Buffer.from(str) : str;
  const readable = new Readable();
  readable._read = () => {}; // _read is required but you can noop it
  readable.push(content);
  readable.push(null);

  return new Promise((resolve, reject) => {
    client.uploadFrom(readable, remotePath, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

/**
 * Write local file to remote path via FTP
 * @param {Object} client - FTP client instance
 * @param {String} localPath - Path of the local file
 * @param {String} remotePath - Path to write the file on the remote server
 * @returns {Promise<void>}
 */
exports.writeLocalToRemote = async (client, localPath, remotePath) => {
  return new Promise((resolve, reject) => {
    client.uploadFrom(localPath, remotePath, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

/**
 * Read remote file to local path via FTP
 * @param {Object} client - FTP client instance
 * @param {String} remotePath - Path of the file on the remote server
 * @param {String} localPath - Path to write the file locally
 * @returns {Promise<void>}
 */
exports.readRemoteToLocal = async (client, remotePath, localPath) => {
  return new Promise((resolve, reject) => {
    client.downloadTo(localPath, remotePath, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};