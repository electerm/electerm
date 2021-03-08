/**
 * command line support
 */

const { program } = require('commander')

const { packInfo } = require('../utils/app-props')
const { version } = packInfo
const isTest = process.env.NODE_TEST

let helpInfo
let options

if (!isTest) {
  program
    .version(version)
    .name('electerm')
    .usage('[options] sshServer')
    .description(`Connect ssh server from command line, examples:
    electerm user@xx.com
    electerm user@xx.com:22
    electerm -l user -P 22 -i /path/to/private-key -pw password xx.com
    `)
    .option('-l, --user <user>', 'specify a login name')
    .option('-P, --port <port>', 'specify ssh port')
    .option('-i, --private-key-path <path>', 'specify an SSH private key path')
    .option('-ps, --passphrase <passphrase>', 'specify an SSH private key passphrase')
    .option('-pw, --password <password>', 'specify ssh server password')
    .exitOverride()

  helpInfo = program.helpInformation()
  try {
    program.parse()
  } catch (err) {
    if (err.message.includes('outputHelp')) {
      process.exit(0)
    }
  }
  options = program.opts()
}

exports.initCommandLine = function () {
  if (isTest) {
    return false
  }
  return {
    options,
    argv: program.args,
    helpInfo
  }
}
