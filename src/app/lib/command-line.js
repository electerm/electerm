/**
 * command line support
 */

const { program } = require('commander')

const { packInfo } = require('../utils/app-props')
const { version } = packInfo
const isTest = process.env.NODE_TEST

let argv
let filtered
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
    .option('-ps, --passphrase <passphrase>', 'specify an SSH private key path')
    .option('-pw, --password <password>', 'specify ssh server password')

  argv = process.argv
  filtered = argv.filter(d => d !== '-h' && d !== '--help')
  helpInfo = program.helpInformation()
  program.parse(filtered)
  options = program.opts()
}

exports.initCommandLine = function () {
  if (isTest) {
    return false
  }
  if (
    argv &&
    (argv.includes('-h') || argv.includes('--help'))
  ) {
    return {
      isHelp: true,
      helpInfo
    }
  }
  return {
    options,
    argv: filtered,
    helpInfo
  }
}
