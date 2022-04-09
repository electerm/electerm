// export install src
const {
  isWin,
  isMac,
  isArm
} = require('../common/runtime-constants')

let init = 'not-inited'
if (isWin) {
  init = 'win-x64.tar.gz'
} else if (isMac || isArm) {
  init = 'mac-x64.dmg'
} else {
  init = 'linux-x64.tar.gz'
}
module.exports = init
