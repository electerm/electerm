
const { resolve } = require('path')
const { cp, rm } = require('shelljs')

const from = resolve(__dirname, '../package.json')
const to = resolve(__dirname, '../package-bak.json')
cp(to, from)
rm(to)
