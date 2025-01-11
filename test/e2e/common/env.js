/**
 * export test username/password/host/port
 */
require('dotenv').config({
  override: true
})
const os = require('os').platform()
const {
  env
} = process

const TEST_HOST = env[`TEST_HOST_${os}`] || env.TEST_HOST
const TEST_PASS = env[`TEST_PASS_${os}`] || env.TEST_PASS
const TEST_USER = env[`TEST_USER_${os}`] || env.TEST_USER

if (!TEST_HOST || !TEST_PASS || !TEST_USER) {
  throw new Error(`
    basic sftp test need TEST_HOST TEST_PASS TEST_USER env set,
    you can run "cp .sample.env .env" to create env file, then edit .env, fill all required field
  `)
}

module.exports = {
  TEST_HOST,
  TEST_PASS,
  TEST_USER
}
