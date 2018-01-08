/**
 * replace antd icon font resource
 */
const git = require('git-rev-sync')
const version = git.long()
module.exports = exports.default = function (source) {
  this.cacheable()

  return source
    .replace(/'[^']+\.eot'/, `'../../_bc/electerm-resource/res/fonts/iconfont.eot?t=${version}'`)
    .replace(/'[^']+\.eot\?#iefix'/, `'../../_bc/electerm-resource/res/fonts/iconfont.eot?t=${version}#iefix'`)
    .replace(/'[^']+\.woff'/, `'../../_bc/electerm-resource/res/fonts/iconfont.woff?t=${version}'`)
    .replace(/'[^']+\.ttf'/, `'../../_bc/electerm-resource/res/fonts/iconfont.ttf?t=${version}'`)
    .replace(/'[^']+\.svg#iconfont'/, `'../../_bc/electerm-resource/res/fonts/iconfont.svg?t=${version}#iconfont'`)
}
