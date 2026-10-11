#!/bin/bash
const { exec, cd } = require('shelljs')
const { resolve } = require('path')
const p = resolve(__dirname, '../vite')
cd(p)

exec('npm run build')
