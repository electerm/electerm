// build html
/**
 * build common files with react module in it
 */
const fs = require('fs')
const pug = require('pug')
const { resolve } = require('path')
const pack = require('../../package.json')
const deepCopy = require('json-deep-copy')

const entryPug = resolve(
  __dirname,
  '../../src/client/views/index.pug'
)
const targetFilePath = resolve(
  __dirname,
  '../../work/app/assets/index.html'
)
const pugContent = fs.readFileSync(entryPug, 'utf-8')
const data = {
  version: pack.version,
  siteName: pack.name,
  isDev: false
}
const htmlContent = pug.render(pugContent, {
  filename: entryPug,
  ...data,
  _global: deepCopy(data)
})
fs.writeFileSync(targetFilePath, htmlContent, 'utf8')
