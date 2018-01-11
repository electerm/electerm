/**
 * constants
 */

let {NODE_ENV} = process.env

module.exports = {
  isDev: NODE_ENV === 'development',
  defaultLang: 'zh_cn'
}

