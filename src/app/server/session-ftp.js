const ftp = require('basic-ftp');
const { TerminalBase } = require('./session-base');
const { readRemoteFile, writeRemoteFile } = require('./ftp-file');
const { getSizeCount } = require('../common/get-folder-size-and-file-count');

class Ftp extends TerminalBase {
  constructor(initOptions) {
    super(initOptions);
    this.transfers = {};
  }

  async connect(initOptions) {
    this.client = new ftp.Client();
    this.client.ftp.verbose = false;
    await this.client.access({
      host: initOptions.host,
      port: initOptions.port || 21,
      user: initOptions.username,
      password: initOptions.password,
      secure: initOptions.secure
    });
    this.sftp = this.client; // For API compatibility
    return 'ok';
  }

  kill() {
    Object.values(this.transfers).forEach(transfer => {
      if (transfer && transfer.destroy) transfer.destroy();
    });
    this.transfers = {};
    if (this.client) this.client.close();
    this.sftp = null;
    this.onEndConn();
  }

  async getHomeDir() {
    return this.client.pwd();
  }

  async rmdir(remotePath) {
    try {
      await this.client.removeDir(remotePath);
      return 1;
    } catch (err) {
      return this.removeDirectoryRecursively(remotePath);
    }
  }

  async removeDirectoryRecursively(remotePath) {
    const contents = await this.list(remotePath);
    for (const item of contents) {
      const itemPath = `${remotePath}/${item.name}`;
      if (item.type === 'd') {
        await this.removeDirectoryRecursively(itemPath);
      } else {
        await this.rm(itemPath);
      }
    }
    await this.rmFolder(remotePath);
    return 1;
  }

  async touch(remotePath) {
    const buffer = Buffer.from('');
    await this.client.uploadFrom(buffer, remotePath);
    return 1;
  }

  async mkdir(remotePath, options = {}) {
    await this.client.ensureDir(remotePath);
    return 1;
  }

  async stat(remotePath) {
    const list = await this.client.list(remotePath);
    if (!list || !list.length) throw new Error('stat failed');
    const item = list[0];
    return {
      size: item.size,
      accessTime: new Date(item.modifiedAt).getTime(),
      modifyTime: new Date(item.modifiedAt).getTime(),
      mode: 0o777, // Default permissions since FTP doesn't provide this
      isDirectory: () => item.type === 2
    };
  }

  async readlink(remotePath) {
    return remotePath; // FTP doesn't support symlinks directly
  }

  async realpath(remotePath) {
    const currentPath = await this.client.pwd();
    await this.client.cd(remotePath);
    const realPath = await this.client.pwd();
    await this.client.cd(currentPath);
    return realPath;
  }

  async lstat(remotePath) {
    return this.stat(remotePath);
  }

  async chmod(remotePath, mode) {
    // FTP doesn't support chmod, so we'll just return 1
    return 1;
  }

  async rename(remotePath, remotePathNew) {
    await this.client.rename(remotePath, remotePathNew);
    return 1;
  }

  async rmFolder(remotePath) {
    await this.client.removeDir(remotePath);
    return 1;
  }

  async rm(remotePath) {
    await this.client.remove(remotePath);
    return 1;
  }

  async list(remotePath) {
    const list = await this.client.list(remotePath);
    return list.map(item => ({
      type: item.type === 2 ? 'd' : '-',
      name: item.name,
      size: item.size,
      modifyTime: new Date(item.modifiedAt).getTime(),
      accessTime: new Date(item.modifiedAt).getTime(),
      mode: 0o777,
      rights: { user: 'rwx', group: 'rwx', other: 'rwx' },
      owner: 'owner',
      group: 'group'
    }));
  }

  async readFile(remotePath) {
    return readRemoteFile(this.client, remotePath);
  }

  async writeFile(remotePath, str, mode) {
    return writeRemoteFile(this.client, remotePath, str, mode);
  }

  async getFolderSize(folderPath) {
    const result = await this.runExec(`du -sh "${folderPath}" && find "${folderPath}" -type f | wc -l`);
    return getSizeCount(result);
  }

  async runExec(cmd) {
    return this.client.execute(cmd);
  }
}

exports.Ftp = Ftp;