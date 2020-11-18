/**
 * load font list after start
 */

const log = require('../utils/log')

exports.loadFontList = () => {
  return require('font-list').getFonts()
    .then(fonts => {
      return fonts.map(f => f.replace(/"/g, ''))
    })
    .catch(err => {
      log.error('load font list error')
      log.error(err)
      return []
    })
}
