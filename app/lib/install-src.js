// export install src for linux dist

const {resolve} = require('path')
let installSrc = ''

try {
  installSrc = require('fs').readFileSync(
    resolve(__dirname, '../../install-src.txt')
  ).toString().trim()
} catch(e) {
  console.log('no ../../install-src file')
}
if (!installSrc) {
  try {
    installSrc = require('fs').readFileSync(
      resolve(__dirname, '../install-src.txt')
    ).toString().trim()
  } catch(e) {
    console.log('no install-src file')
  }
}

module.exports = installSrc

