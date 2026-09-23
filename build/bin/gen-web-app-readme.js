const fs = require('fs')
const { resolve } = require('path')

// Generate build/web-app/README.md from the root README.md by inserting a
// single descriptive line for the react components pack.
const from = resolve(__dirname, '../../README.md')
const to = resolve(__dirname, '../web-app/README.md')

const EXTRA_LINE = 'This is react components pack for electerm sub projects'

const content = fs.readFileSync(from, 'utf8')
const lines = content.split('\n')

// Insert right before the project description line (starts with "Open-sourced terminal").
const idx = lines.findIndex(l => /^Open-sourced terminal/.test(l.trim()))
if (idx !== -1) {
  lines.splice(idx, 0, EXTRA_LINE, '')
} else {
  lines.unshift(EXTRA_LINE, '')
}

fs.writeFileSync(to, lines.join('\n'))
console.log('generated build/web-app/README.md')
