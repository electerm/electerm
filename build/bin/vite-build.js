#!/bin/bash
const { exec, cd } = require('shelljs')
const { resolve } = require('path')
const p = resolve(__dirname, '../vite')
cd(p)
// const arr = [
//   {
//     entry: 'electerm',
//     file: 'index.jsx'
//   },
//   {
//     entry: 'basic',
//     file: 'basic.js'
//   },
//   {
//     entry: 'worker',
//     file: 'worker.js'
//   }
// ]
// for (const obj of arr) {
//   exec(`ENTRY=${obj.entry} FILE=${obj.file} npm run build`)
// }

exec('npm run build')
