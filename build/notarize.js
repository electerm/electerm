require('dotenv').config()
const {
  resolve
} = require('path')
const {
  notarize
} = require('electron-notarize')

exports.default = async function notarizing (context) {
  const {
    electronPlatformName
  } = context
  if (electronPlatformName !== 'darwin') {
    return
  }
  const path = resolve(
    __dirname,
    '../dist/mac/electerm.app'
  )
  console.log('doing notarize...')
  return notarize({
    appBundleId: 'org.electerm.electerm',
    appPath: path,
    appleId: process.env.APPLEID,
    appleIdPassword: process.env.APPLEIDPASS
  })
}
