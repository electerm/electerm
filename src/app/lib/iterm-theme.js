/**
 * read themes from https://github.com/mbadolato/iTerm2-Color-Schemes/tree/master/electerm
 */

const {
  resolve
} = require('path')
const {
  isDev
} = require('../common/runtime-constants')
const {
  fsExport
} = require('./fs')

const folder = resolve(
  __dirname,
  (
    isDev
      ? '../../../node_modules/iTerm2-Color-Schemes/electerm'
      : '../assets/iTerm2-Color-Schemes'
  )
)

exports.listItermThemes = async () => {
  const list = await fsExport.readdirAsync(folder)
    .catch(e => {
      console.log(e)
      return ''
    })
  if (!list) {
    return []
  }
  const all = list.map(f => {
    return fsExport.readFile(
      resolve(folder, f)
    )
  })
  return Promise.all(all).catch(e => {
    console.log(e)
    return []
  })
}
