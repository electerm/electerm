/**
 * command line support
 */

const { packInfo, isTest } = require('../common/app-props')
const { version } = packInfo

let helpInfo
let options
let program

function parseCommandLine (argv, options) {
  const { Command } = require('commander')
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

### other connection types
- telnet:
electerm -tp "telnet" -opts '{"host":"192.168.1.1","port":21","username":"root","password":"123456"}'
- rdp: electerm -tp "rdp" -opts '{"host":"192.168.1.1","port":3389","username":"root","password":"123456"}'
- vnc: electerm -tp "vnc" -opts '{"host":"192.168.1.1","port":3389","username":"root","password":"123456"}'
- serial: electerm -tp "serial" -opts '{"port":"COM1","baudRate":115200,"dataBits":8,"stopBits":1,"parity":"none"}'
- local: electerm -tp "local" -opts '{"title": "local terminal"}'

### Environment variables:
- DB_PATH:
DB_PATH=/custom/path/to/electerm/db electerm

- NO_PROXY_SERVER:
NO_PROXY_SERVER=1 electerm

- PROXY_BYPASS_LIST:
PROXY_BYPASS_LIST="localhost, 127.0.0.1" electerm

- PROXY_PAC_URL:
PROXY_PAC_URL="http://proxy.example.com/pac" electerm

- PROXY_SERVER:
PROXY_SERVER="socks5://127.0.0.1:1080" electerm
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
    .option('-d, --init-folder <initFolder>', 'init folder got init terminal')
    .option('-tp, --tp <tp>', 'specify connection type')
    .option('-opts, --opts <opts>', 'specify connection options, json string')
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
