const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');
const { Ftp } = require('../src/app/server/session-ftp');

let ftpServer;

test.describe('Ftp', () => {
  let ftp;

  test.beforeAll(async () => {
    // Start FTP server
    const serverPath = path.join(__dirname, '../temp/ftp/src/ftp.js');
    ftpServer = spawn('node', [serverPath]);

    await new Promise((resolve) => {
      ftpServer.stdout.on('data', (data) => {
        if (data.toString().includes('FTP server is running at port 21')) {
          resolve();
        }
      });
    });

    ftpServer.stderr.on('data', (data) => {
      console.error(`FTP server error: ${data}`);
    });
  });

  test.afterAll(async () => {
    // Stop FTP server
    ftpServer.kill();
    await new Promise((resolve) => ftpServer.on('close', resolve));
  });

  test.beforeEach(async () => {
    ftp = new Ftp({
      host: 'localhost',
      port: 21,
      username: 'test',
      password: 'test123'
    });
    await ftp.connect();
  });

  test.afterEach(async () => {
    if (ftp) {
      ftp.kill();
    }
  });

  test('should connect to FTP server', async () => {
    expect(ftp.client).toBeTruthy();
  });

  test('should list directory contents', async () => {
    const list = await ftp.list('/');
    expect(Array.isArray(list)).toBeTruthy();
    expect(list.length).toBeGreaterThanOrEqual(0);
  });

  test('should create and delete a directory', async () => {
    const testDir = '/test_dir';
    await ftp.mkdir(testDir);
    let list = await ftp.list('/');
    expect(list.some(item => item.name === 'test_dir')).toBeTruthy();

    await ftp.rmdir(testDir);
    list = await ftp.list('/');
    expect(list.some(item => item.name === 'test_dir')).toBeFalsy();
  });

  test('should upload and download a file', async () => {
    const localFile = path.join(__dirname, 'test_file.txt');
    const remoteFile = '/test_file.txt';
    const content = 'Hello, FTP!';

    // Create local file
    await fs.writeFile(localFile, content);

    // Upload file
    await ftp.writeFile(remoteFile, content);

    // Download file
    const downloadedContent = await ftp.readFile(remoteFile);
    expect(downloadedContent.toString()).toBe(content);

    // Clean up
    await ftp.rm(remoteFile);
    await fs.unlink(localFile);
  });
});