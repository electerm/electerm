/**
 * Standard batch-op example workflow for e2e tests.
 * Covers: connect, command (create file + log), sftp_download,
 *         sftp_upload, command (verify + cleanup).
 */

const {
  TEST_HOST,
  TEST_PORT,
  TEST_USER,
  TEST_PASS
} = require('./env')

module.exports = [
  {
    name: 'Connect SSH',
    action: 'connect',
    params: {
      host: TEST_HOST,
      port: parseInt(TEST_PORT, 10),
      username: TEST_USER,
      authType: 'password',
      password: TEST_PASS,
      enableSftp: true
    }
  },
  {
    name: 'Create test file',
    action: 'command',
    afterDelay: 500,
    params: {
      command: "echo 'hello batch-op' > /tmp/batch_test.txt && echo '[LOG] File created'"
    }
  },
  {
    name: 'Log file content',
    action: 'command',
    params: {
      command: 'cat /tmp/batch_test.txt'
    }
  },
  {
    name: 'Download test file',
    action: 'sftp_download',
    afterDelay: 200,
    params: {
      remotePath: '/tmp/batch_test.txt',
      localPath: '/tmp/batch_test_local.txt'
    }
  },
  {
    name: 'Delete remote source file',
    action: 'command',
    afterDelay: 200,
    params: {
      command: "rm -f /tmp/batch_test.txt && echo '[LOG] Remote source deleted'"
    }
  },
  {
    name: 'Upload file back',
    action: 'sftp_upload',
    afterDelay: 200,
    params: {
      localPath: '/tmp/batch_test_local.txt',
      remotePath: '/tmp/batch_test_uploaded.txt'
    }
  },
  {
    name: 'Verify and clean up',
    action: 'command',
    params: {
      command: "ls -la /tmp/batch_test_uploaded.txt && rm -f /tmp/batch_test*.txt && echo '[LOG] All done'"
    }
  }
]
