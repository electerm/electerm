
let {resolve} = require('path')
let {cp, rm} = require('shelljs')

let from = resolve(__dirname, '../package.json')
let to = resolve(__dirname, '../package-bak.json')
cp(to, from)
rm(to)

