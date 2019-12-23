/**
 * load font list after start
 */

const fontList = require('font-list')
const log = require('../utils/log')

exports.loadFontList = () => {
  return fontList.getFonts()
    .then(fonts => {
      return fonts.map(f => f.replace(/"/g, ''))
    })
    .catch(err => {
      log.error('load font list error')
      log.error(err)
      return []
    })
}
