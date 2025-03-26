const { test, expect } = require('@playwright/test');
const path = require('path');
const { spawn } = require('child_process');
const { Ftp } = require('../../src/app/server/session-ftp');

let ftpServer;

test.describe('Ftp', () => {
  let ftp;

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
  }, 60000);

  test.afterAll(async () => {
    if (ftpServer) {
      ftpServer.kill();
      await new Promise((resolve) => ftpServer.on('close', resolve));
    }
  });

  test.beforeEach(async () => {
    ftp = new Ftp({
      host: 'localhost',
      port: 21,
      username: 'test',
      password: 'test123'
    });
    await ftp.connect(ftp.initOptions);
  });

  test.afterEach(async () => {
    if (ftp) {
      ftp.kill();
    }
  });

  test('should connect to FTP server', async () => {
    expect(ftp.client).toBeTruthy();
  });

  test('should get home directory', async () => {
    const homeDir = await ftp.getHomeDir();
    expect(homeDir).toBeTruthy();
  });

  test('should list directory contents', async () => {
    const list = await ftp.list('/');
    expect(Array.isArray(list)).toBeTruthy();
    expect(list.length).toBeGreaterThanOrEqual(0);
  });

  test('should create, stat, and delete a file', async () => {
    const testFile = '/test_file.txt';
    await ftp.touch(testFile);
    
    const stat = await ftp.stat(testFile);
    expect(stat.isDirectory()).toBeFalsy();
    
    await ftp.rm(testFile);
    await expect(ftp.stat(testFile)).rejects.toThrow();
  });

  test('should create, list, and delete a directory', async () => {
    const testDir = '/test_dir';
    await ftp.mkdir(testDir);
    
    const list = await ftp.list('/');
    expect(list.some(item => item.name === 'test_dir' && item.type === 'd')).toBeTruthy();
    
    await ftp.rmdir(testDir);
    const newList = await ftp.list('/');
    expect(newList.some(item => item.name === 'test_dir')).toBeFalsy();
  });

  test('should rename a file', async () => {
    const originalName = '/original.txt';
    const newName = '/renamed.txt';
    
    await ftp.touch(originalName);
    await ftp.rename(originalName, newName);
    
    const list = await ftp.list('/');
    expect(list.some(item => item.name === 'renamed.txt')).toBeTruthy();
    expect(list.some(item => item.name === 'original.txt')).toBeFalsy();
    
    await ftp.rm(newName);
  });

  test('should write and read a file', async () => {
    const testFile = '/test_content.txt';
    const content = 'Hello, FTP!';
    
    await ftp.writeFile(testFile, content);
    const readContent = await ftp.readFile(testFile);
    
    expect(readContent.toString()).toBe(content);
    
    await ftp.rm(testFile);
  });

  test('should get real path', async () => {
    const realPath = await ftp.realpath('/');
    expect(realPath).toBeTruthy();
  });

  test('should perform lstat', async () => {
    const stat = await ftp.lstat('/');
    expect(stat.isDirectory()).toBeTruthy();
  });

  test('should handle chmod (even though it\'s not supported)', async () => {
    const result = await ftp.chmod('/', '755');
    expect(result).toBe(1);
  });

  test('should get folder size', async () => {
    const testDir = '/size_test_dir';
    await ftp.mkdir(testDir);
    await ftp.writeFile(`${testDir}/file1.txt`, 'Content 1');
    await ftp.writeFile(`${testDir}/file2.txt`, 'Content 2');
    
    const size = await ftp.getFolderSize(testDir);
    expect(size.size).toBeGreaterThan(0);
    expect(size.count).toBe(2);
    
    await ftp.rmdir(testDir);
  });

  test('should run exec command', async () => {
    const result = await ftp.runExec('pwd');
    expect(result).toBeTruthy();
  });
});