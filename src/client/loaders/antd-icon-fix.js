/**
 * 替换antd
 */
const git = require('git-rev-sync')
const version = git.long()
module.exports = exports.default = function (source) {
  this.cacheable()

  return source
    .replace(/'[^']+\.eot'/, `'../../static/fonts/iconfont.eot?t=${version}'`)
    .replace(/'[^']+\.eot\?#iefix'/, `'../../static/fonts/iconfont.eot?t=${version}#iefix'`)
    .replace(/'[^']+\.woff'/, `'../../static/fonts/iconfont.woff?t=${version}'`)
    .replace(/'[^']+\.ttf'/, `'../../static/fonts/iconfont.ttf?t=${version}'`)
    .replace(/'[^']+\.svg#iconfont'/, `'../../static/fonts/iconfont.svg?t=${version}#iconfont'`)
}
