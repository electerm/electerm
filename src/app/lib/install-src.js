// export install src for linux dist

import {resolve} from 'path'
import log from '../utils/log'

let installSrc = ''

try {
  installSrc = require('fs').readFileSync(
    resolve(__dirname, '../../install-src.txt')
  ).toString().trim()
} catch(e) {
  log.info('no ../../install-src file')
}
if (!installSrc) {
  try {
    installSrc = require('fs').readFileSync(
      resolve(__dirname, '../install-src.txt')
    ).toString().trim()
  } catch(e) {
    log.info('no install-src file')
  }
}

export default installSrc

