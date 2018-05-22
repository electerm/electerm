/**
 * export test username/password/host/port
 */

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
    you can run theselines(replace xxxx with real ones) to set env:
    export TEST_HOST=xxxx.xxx && export TEST_PASS=xxxxxx && export TEST_USER=xxxxxx
  `)
}

module.exports = {
  TEST_HOST,
  TEST_PASS,
  TEST_USER
}
