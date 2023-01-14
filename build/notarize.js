require('dotenv').config()
const {
  resolve
} = require('path')
const {
  notarize
} = require('electron-notarize')

module.exports = exports.default = async function notarizing () {
  if (process.platform !== 'darwin') {
    return
  }
  const path = resolve(
    __dirname,
    '../dist/mac/electerm.app'
  )
  console.log('doing notarize...')
  await notarize({
    appBundleId: 'org.electerm.electerm',
    appPath: path,
    appleId: process.env.APPLEID,
    appleIdPassword: process.env.APPLEIDPASS
  }).catch(err => {
    console.log(err)
  })
}
