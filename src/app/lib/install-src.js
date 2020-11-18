// export install src for linux dist

const { resolve } = require('path')
// const log = require('../utils/log')

function getInstallSrc () {
  let installSrc = ''

  try {
    installSrc = require('fs').readFileSync(
      resolve(__dirname, '../../install-src.txt')
    ).toString().trim()
  } catch (e) {
    // log.info('no ../../install-src file')
  }
  if (!installSrc) {
    try {
      installSrc = require('fs').readFileSync(
        resolve(__dirname, '../install-src.txt')
      ).toString().trim()
    } catch (e) {
      // log.info('no install-src file')
    }
  }
}

module.exports = getInstallSrc
