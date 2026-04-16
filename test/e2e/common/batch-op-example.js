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
    name: 'Create 5M Test File',
    action: 'command',
    beforeDelay: 500,
    afterDelay: 500,
    command: "fallocate -l 5M /tmp/test_5m_file.bin && rm -f /tmp/test_log.log && echo '[LOG] Created 5M test file at $(date)' >> /tmp/test_log.log"
  },
  {
    name: 'Log creation',
    action: 'command',
    afterDelay: 200,
    command: "ls -la /tmp/test_5m_file.bin >> /tmp/test_log.log 2>&1 && echo '[LOG] File size logged at $(date)' >> /tmp/test_log.log"
  },
  {
    name: 'Download 5M File',
    action: 'sftp_download',
    afterDelay: 200,
    remotePath: '/tmp/test_5m_file.bin',
    localPath: '/tmp/test_5m_file.bin'
  },
  {
    name: 'Log after download',
    action: 'command',
    afterDelay: 200,
    command: "echo '[LOG] Download complete at $(date)' >> /tmp/test_log.log"
  },
  {
    name: 'Delete Remote 5M File',
    action: 'command',
    afterDelay: 200,
    command: "rm /tmp/test_5m_file.bin && echo '[LOG] Deleted remote 5M file at $(date)' >> /tmp/test_log.log"
  },
  {
    name: 'Upload Downloaded File to Remote',
    action: 'sftp_upload',
    afterDelay: 200,
    localPath: '/tmp/test_5m_file.bin',
    remotePath: '/tmp/test_5m_file_uploaded.bin'
  },
  {
    name: 'Log after upload',
    action: 'command',
    afterDelay: 200,
    command: "echo '[LOG] Upload complete at $(date)' >> /tmp/test_log.log"
  },
  {
    name: 'Verify and clean up',
    action: 'command',
    command: "ls -la /tmp/test_5m_file_uploaded.bin >> /tmp/test_log.log 2>&1 && rm -f /tmp/test_5m_file*.bin && echo '[LOG] Cleaned up at $(date)' >> /tmp/test_log.log"
  }
]
