/**
 * command line support
 */

const { program } = require('commander')

const { packInfo } = require('../utils/app-props')
const { version } = packInfo

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

const { argv } = process
const filtered = argv.filter(d => d !== '-h' && d !== '--help')
const helpInfo = program.helpInformation()
program.parse(filtered)
const options = program.opts()

exports.initCommandLine = function () {
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
