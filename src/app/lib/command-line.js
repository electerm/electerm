/**
 * command line support
 */

const { Command } = require('commander')
const { packInfo, isTest } = require('../common/app-props')
const { version } = packInfo

let helpInfo
let options
let program

function parseCommandLine (argv, options) {
  const prog = new Command()

  prog
    .version(version)
    .name('electerm')
    .usage('[options] sshServer')
    .description(`
### Connect ssh server from command line examples:
- electerm user@xx.com
- electerm user@xx.com:22
- electerm --password password --set-env "SECRET=xxx USER=hhhh" user@xx.com:22
- electerm -l user -P 22 -i /path/to/private-key -pw password xx.com -T -t "XX Server"

### Other params examples:

- server port:
electerm -sp 30976

- load and run batch operation from csv file:
electerm -bo "/home/root/works.csv"

`)
    .option('-t, --title [Tab Name]', 'Specify the title of the new tab')
    .option('-nw, --new-window', 'Open this connection using standalone window')
    .option('-l, --user <user>', 'specify a login name')
    .option('-P, --port <port>', 'specify ssh port')
    .option('-bo, --batch-op <batchOpFile>', 'load and run batch operation from csv file')
    .option('-sp, --server-port <serverPort>', 'specify server port, default is')
    .option('-i, --private-key-path <path>', 'specify an SSH private key path')
    .option('-ps, --passphrase <passphrase>', 'specify an SSH private key passphrase')
    .option('-pw, --password <password>', 'specify ssh server password')
    .option('-se, --set-env <setEnv>', 'specify envs')
    .option('-so, --sftp-only', 'only show sftp panel')
    .exitOverride()

  try {
    prog.parse(argv, options)
  } catch (err) {
    if (err.message.includes('outputHelp')) {
      process.exit(0)
    }
  }
  return prog
}

if (!isTest) {
  program = parseCommandLine()
  options = program.opts()
  helpInfo = program.helpInformation()
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
