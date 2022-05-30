/**
 * read themes from https://github.com/mbadolato/iTerm2-Color-Schemes/tree/master/electerm
 */

const {
  resolve
} = require('path')
const {
  isDev
} = require('../common/runtime-constants')
const fs = require('fs/promises')

const folder = resolve(
  __dirname,
  (
    isDev
      ? '../../../build/iTerm2-Color-Schemes/electerm'
      : '../assets/iTerm2-Color-Schemes'
  )
)

exports.listItermThemes = async () => {
  const list = await fs.readdir(folder)
    .catch(e => {
      console.log(e)
      return ''
    })
  if (!list) {
    return []
  }
  const all = list.map(f => {
    return fs.readFile(
      resolve(folder, f)
    ).then(t => t.toString())
  })
  return Promise.all(all).catch(e => {
    console.log(e)
    return []
  })
}
