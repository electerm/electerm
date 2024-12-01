/**
 * style compiler
 * collect all stylus files in src/client and merge into one str
 */

// const { isDev } = require('../utils/app-props')
import { resolve } from 'path'
import { readFileSync } from 'fs'
import { cwd } from './common.js'
import { globSync } from 'glob'

function findFiles (pattern) {
  return globSync(pattern)
}

export function loadDevStylus () {
  const dir = resolve(cwd, '../../src/client')
  const pat = dir + '/**/*.styl'
  const arr = findFiles(pat)
  const key = 'theme-default.styl'
  arr.sort((a, b) => {
    const ai = a.includes(key) ? 1 : 0
    const bi = b.includes(key) ? 1 : 0
    return bi - ai
  })
  let all = ''
  for (const p of arr) {
    const text = readFileSync(p).toString()
    if (text.includes('@require') || text.includes(' = ')) {
      all = all + text
    }
  }
  all = all.replace(/@require[^\n]+\n/g, '\n')
  return all
}
