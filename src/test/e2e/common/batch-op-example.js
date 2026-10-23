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

// The e2e ssh server runs on 127.0.0.1, so "remote" and "local" share one
// filesystem here (they do not on the real test host). Keep the two sides on
// different paths, otherwise the `Delete Remote 5M File` step below deletes the
// file the previous step just downloaded, and the upload fails with ENOENT.
const REMOTE_DIR = '/tmp/electerm-batch-op'
const REMOTE_FILE = `${REMOTE_DIR}/test_5m_file.bin`
const REMOTE_LOG = `${REMOTE_DIR}/test_log.log`
const LOCAL_FILE = '/tmp/electerm-batch-op-local.bin'

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
    prevDelay: 500,
    afterDelay: 500,
    // fallocate is not on every unix (macOS/BSD), dd is
    command: `mkdir -p ${REMOTE_DIR} && rm -f ${REMOTE_FILE} ${REMOTE_LOG} && ` +
      `(fallocate -l 5M ${REMOTE_FILE} || dd if=/dev/zero of=${REMOTE_FILE} bs=1M count=5) && ` +
      `echo '[LOG] Created 5M test file at $(date)' >> ${REMOTE_LOG}`
  },
  {
    name: 'Log creation',
    action: 'command',
    afterDelay: 200,
    command: `ls -la ${REMOTE_FILE} >> ${REMOTE_LOG} 2>&1 && ` +
      `echo '[LOG] File size logged at $(date)' >> ${REMOTE_LOG}`
  },
  {
    name: 'Download 5M File',
    action: 'sftp_download',
    afterDelay: 200,
    remotePath: REMOTE_FILE,
    localPath: LOCAL_FILE
  },
  {
    name: 'Log after download',
    action: 'command',
    afterDelay: 200,
    command: `echo '[LOG] Download complete at $(date)' >> ${REMOTE_LOG}`
  },
  {
    name: 'Delete Remote 5M File',
    action: 'command',
    afterDelay: 200,
    command: `rm ${REMOTE_FILE} && ` +
      `echo '[LOG] Deleted remote 5M file at $(date)' >> ${REMOTE_LOG}`
  },
  {
    name: 'Upload Downloaded File to Remote',
    action: 'sftp_upload',
    afterDelay: 200,
    localPath: LOCAL_FILE,
    remotePath: `${REMOTE_DIR}/test_5m_file_uploaded.bin`
  },
  {
    name: 'Log after upload',
    action: 'command',
    afterDelay: 200,
    command: `echo '[LOG] Upload complete at $(date)' >> ${REMOTE_LOG}`
  },
  {
    name: 'Verify and clean up',
    action: 'command',
    command: `ls -la ${REMOTE_DIR}/test_5m_file_uploaded.bin >> ${REMOTE_LOG} 2>&1 && ` +
      `rm -f ${REMOTE_DIR}/test_5m_file*.bin && ` +
      `echo '[LOG] Cleaned up at $(date)' >> ${REMOTE_LOG}`
  }
]
