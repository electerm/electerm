const { test, expect } = require('@playwright/test');
const { Ftp } = require('../../src/app/server/session-ftp');
const { spawn } = require('child_process');
const path = require('path');

let ftpServer;
let ftp;

test.describe('Ftp Class', () => {
  test.beforeAll(async () => {
    // Start FTP server
    const serverPath = path.join(__dirname, '../../temp/ftp/src/ftp.js');
    ftpServer = spawn('node', [serverPath]);

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('FTP server start timeout'));
      }, 50000);

      ftpServer.stdout.on('data', (data) => {
        console.log(`FTP server output: ${data}`);
        if (data.toString().includes('FTP server is running at port 21')) {
          clearTimeout(timeout);
          resolve();
        }
      });

      ftpServer.stderr.on('data', (data) => {
        console.error(`FTP server error: ${data}`);
      });

      ftpServer.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    // Wait a bit to ensure the server is fully ready
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Initialize FTP client
    ftp = new Ftp({ 
      host: 'localhost', 
      port: 21, 
      username: 'test', 
      password: 'test123',
      sessionId: 'test-session'
    });
    await ftp.connect();
  }, 60000);

  test.afterAll(async () => {
    if (ftpServer) {
      ftpServer.kill();
      await new Promise((resolve) => ftpServer.on('close', resolve));
    }
  });

  test('should connect to FTP server', async () => {
    const result = await ftp.connect();
    expect(result).toBe('ok');
  });

  test('should list directory contents', async () => {
    const list = await ftp.list('/');
    expect(Array.isArray(list)).toBeTruthy();
  });

  test('should create and remove a directory', async () => {
    await ftp.mkdir('/testdir');
    let list = await ftp.list('/');
    expect(list.some(item => item.name === 'testdir')).toBeTruthy();

    await ftp.rmdir('/testdir');
    list = await ftp.list('/');
    expect(list.some(item => item.name === 'testdir')).toBeFalsy();
  });

  test('should create and remove a file', async () => {
    await ftp.touch('/testfile.txt');
    let list = await ftp.list('/');
    expect(list.some(item => item.name === 'testfile.txt')).toBeTruthy();

    await ftp.rm('/testfile.txt');
    list = await ftp.list('/');
    expect(list.some(item => item.name === 'testfile.txt')).toBeFalsy();
  });

  test('should read and write a file', async () => {
    const content = 'Hello, FTP!';
    await ftp.writeFile('/test.txt', content);
    const readContent = await ftp.readFile('/test.txt');
    expect(readContent.toString()).toBe(content);
    await ftp.rm('/test.txt');
  });

  test('should get file stats', async () => {
    await ftp.touch('/stattest.txt');
    const stats = await ftp.stat('/stattest.txt');
    expect(stats.size).toBeDefined();
    expect(stats.modifyTime).toBeDefined();
    await ftp.rm('/stattest.txt');
  });

  test('should rename a file', async () => {
    await ftp.touch('/oldname.txt');
    await ftp.rename('/oldname.txt', '/newname.txt');
    const list = await ftp.list('/');
    expect(list.some(item => item.name === 'newname.txt')).toBeTruthy();
    expect(list.some(item => item.name === 'oldname.txt')).toBeFalsy();
    await ftp.rm('/newname.txt');
  });

  test('should get folder size', async () => {
    await ftp.mkdir('/sizedir');
    await ftp.writeFile('/sizedir/file1.txt', 'content1');
    await ftp.writeFile('/sizedir/file2.txt', 'content2');
    
    const sizeInfo = await ftp.getFolderSize('/sizedir');
    expect(sizeInfo.size).toBeGreaterThan(0);
    expect(sizeInfo.count).toBe(2);

    await ftp.rmdir('/sizedir');
  });
});